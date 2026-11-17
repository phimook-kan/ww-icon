import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/app/lib/mongodb";
import { Icon, type IIcon } from "@/app/models/Icon";
import { IconSet } from "@/app/models/IconSet";
import { verifyApiAuth } from "@/app/lib/auth";


type IconSetInput = {
  iconSetName: string;
  icons: string[]; // iconUrl
};

type PopulatedIcon = Pick<IIcon, "_id" | "iconUrl" | "iconRole">;

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validate(item: unknown, index: number): { value?: IconSetInput; error?: string } {
  if (typeof item !== "object" || item === null) {
    return { error: `data[${index}] ต้องเป็น object` };
  }
  const { iconSetName, icons } = item as Record<string, unknown>;

  if (typeof iconSetName !== "string" || !iconSetName.trim()) {
    return { error: `data[${index}].iconSetName ต้องเป็น string และห้ามว่าง` };
  }
  if (icons !== undefined && !Array.isArray(icons)) {
    return { error: `data[${index}].icons ต้องเป็น array ของ URL` };
  }

  const list = (icons ?? []) as unknown[];
  for (let j = 0; j < list.length; j++) {
    const url = list[j];
    if (typeof url !== "string" || !isValidUrl(url.trim())) {
      return { error: `data[${index}].icons[${j}] ต้องเป็น URL ที่ถูกต้อง` };
    }
  }

  return {
    value: {
      iconSetName: iconSetName.trim(),
      icons: [...new Set(list.map((u) => (u as string).trim()))],
    },
  };
}

function formatSet(doc: {
  _id: Types.ObjectId;
  iconSetName: string;
  icon: PopulatedIcon[];
  createAt: Date;
}) {
  return {
    iconSetId: doc._id,
    iconSetName: doc.iconSetName,
    createAt: doc.createAt,
    icons: doc.icon.map((i) => ({
      iconId: i._id,
      iconUrl: i.iconUrl,
      iconRole: i.iconRole,
    })),
  };
}

// POST /api/icon-sets — บันทึก iconSets + อัปเดต icons.iconSet
export async function POST(req: NextRequest) {
  const authError = verifyApiAuth(req);
  if (authError) return authError;


  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "JSON ไม่ถูกต้อง" }, { status: 400 });
  }

  const raw = Array.isArray(body) ? body : (body as { data?: unknown })?.data;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { success: false, message: "ต้องส่ง array ของ iconSets อย่างน้อย 1 รายการ" },
      { status: 400 }
    );
  }

  // 1) ตรวจข้อมูล
  const errors: string[] = [];
  const items: IconSetInput[] = [];
  raw.forEach((item, i) => {
    const { value, error } = validate(item, i);
    if (error) errors.push(error);
    else if (value) items.push(value);
  });
  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 400 });
  }

  // 2) รวมเซ็ตที่ชื่อซ้ำกันใน request เดียวกัน
  const merged = new Map<string, Set<string>>();
  for (const s of items) {
    const urls = merged.get(s.iconSetName) ?? new Set<string>();
    s.icons.forEach((u) => urls.add(u));
    merged.set(s.iconSetName, urls);
  }

  // 3) กัน URL เดียวกันอยู่หลายเซ็ต (icon 1 ตัวมีได้แค่ 1 iconSet)
  const owner = new Map<string, string>();
  const conflicts: string[] = [];
  for (const [name, urls] of merged) {
    for (const url of urls) {
      const prev = owner.get(url);
      if (prev && prev !== name) conflicts.push(`${url} อยู่ทั้งใน "${prev}" และ "${name}"`);
      else owner.set(url, name);
    }
  }
  if (conflicts.length > 0) {
    return NextResponse.json(
      { success: false, message: "icon 1 ตัวอยู่ได้แค่ 1 iconSet", errors: conflicts },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    // 4) หา iconId จาก iconUrl
    const foundIcons = await Icon.find({ iconUrl: { $in: [...owner.keys()] } })
      .select("_id iconUrl iconSet")
      .lean();
    const iconByUrl = new Map(foundIcons.map((i) => [i.iconUrl, i]));

    // ใช้เช็คว่าเซ็ตไหนถูกสร้างใหม่
    const names = [...merged.keys()];
    const existing = await IconSet.find({ iconSetName: { $in: names } })
      .select("iconSetName")
      .lean();
    const existingNames = new Set(existing.map((s) => s.iconSetName));

    const summary: {
      iconSetId: Types.ObjectId;
      iconSetName: string;
      created: boolean;
      linked: number;
      moved: number;
      notFound: string[];
    }[] = [];

    for (const [name, urls] of merged) {
      const matched = [...urls].map((u) => iconByUrl.get(u)).filter((i) => !!i);
      const iconIds = matched.map((i) => i._id);
      const notFound = [...urls].filter((u) => !iconByUrl.has(u));

      // 5) สร้าง/อัปเดต iconSet แล้วเพิ่ม iconId เข้า array (ไม่ซ้ำ)
      const set = await IconSet.findOneAndUpdate(
        { iconSetName: name },
        { $addToSet: { icon: { $each: iconIds } } },
        { upsert: true, new: true }
      ).lean();
      if (!set) continue;

      let moved = 0;
      if (iconIds.length > 0) {
        moved = matched.filter((i) => i.iconSet && !i.iconSet.equals(set._id)).length;

        // 6) ลบ icon ออกจากเซ็ตเดิม (ถ้าเคยอยู่เซ็ตอื่น)
        await IconSet.updateMany(
          { _id: { $ne: set._id }, icon: { $in: iconIds } },
          { $pull: { icon: { $in: iconIds } } }
        );

        // 7) อัปเดต icons.iconSet
        await Icon.updateMany({ _id: { $in: iconIds } }, { $set: { iconSet: set._id } });
      }

      summary.push({
        iconSetId: set._id,
        iconSetName: name,
        created: !existingNames.has(name),
        linked: iconIds.length,
        moved,
        notFound,
      });
    }

    // 8) ดึงข้อมูลล่าสุดพร้อมรายละเอียด icon
    const sets = await IconSet.find({ _id: { $in: summary.map((s) => s.iconSetId) } })
      .populate<{ icon: PopulatedIcon[] }>("icon", "iconUrl iconRole")
      .lean();

    const data = summary.map((s) => {
      const doc = sets.find((d) => d._id.equals(s.iconSetId));
      return { ...s, ...(doc ? formatSet(doc) : {}) };
    });

    const anyCreated = summary.some((s) => s.created);
    return NextResponse.json(
      {
        success: true,
        created: summary.filter((s) => s.created).length,
        updated: summary.filter((s) => !s.created).length,
        data,
      },
      { status: anyCreated ? 201 : 200 }
    );
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { success: false, message: "iconSetName ซ้ำ (มีคำขออื่นสร้างพร้อมกัน) กรุณาลองใหม่" },
        { status: 409 }
      );
    }
    console.error("[POST /api/icon-sets]", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดที่ server" },
      { status: 500 }
    );
  }
}

// GET /api/icon-sets?name=Academic bundle — ดึง iconSets พร้อม icons
export async function GET(req: NextRequest) {
  const authError = verifyApiAuth(req);
  if (authError) return authError;

  try {
    await connectDB();
    const name = req.nextUrl.searchParams.get("name");
    const filter = name ? { iconSetName: name } : {};

    const sets = await IconSet.find(filter)
      .sort({ createAt: -1 })
      .populate<{ icon: PopulatedIcon[] }>("icon", "iconUrl iconRole")
      .lean();

    return NextResponse.json({
      success: true,
      total: sets.length,
      data: sets.map(formatSet),
    });
  } catch (err) {
    console.error("[GET /api/icon-sets]", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดที่ server" },
      { status: 500 }
    );
  }
}