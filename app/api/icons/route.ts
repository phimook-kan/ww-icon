import { NextRequest, NextResponse } from "next/server";
import { Types, type AnyBulkWriteOperation } from "mongoose";
import { connectDB } from "@/app/lib/mongodb";
import { Icon, type IIcon } from "@/app/models/Icon";
import { IconSet } from "@/app/models/IconSet";
import { verifyApiAuth } from "@/app/lib/auth"; 


type IconInput = {
  iconUrl: string;
  iconRole: string;
  iconSet?: string;
};

function validate(item: unknown, index: number): { value?: IconInput; error?: string } {
  if (typeof item !== "object" || item === null) {
    return { error: `data[${index}] ต้องเป็น object` };
  }
  const { iconUrl, iconRole, iconSet } = item as Record<string, unknown>;

  if (typeof iconUrl !== "string" || !iconUrl.trim()) {
    return { error: `data[${index}].iconUrl ต้องเป็น string และห้ามว่าง` };
  }
  try {
    new URL(iconUrl);
  } catch {
    return { error: `data[${index}].iconUrl ไม่ใช่ URL ที่ถูกต้อง` };
  }
  if (typeof iconRole !== "string" || !iconRole.trim()) {
    return { error: `data[${index}].iconRole ต้องเป็น string และห้ามว่าง` };
  }
  if (iconSet !== undefined && (typeof iconSet !== "string" || !Types.ObjectId.isValid(iconSet))) {
    return { error: `data[${index}].iconSet ต้องเป็น ObjectId ที่ถูกต้อง` };
  }

  return {
    value: {
      iconUrl: iconUrl.trim(),
      iconRole: iconRole.trim().toLowerCase(),
      ...(iconSet ? { iconSet } : {}),
    },
  };
}

// POST /api/icons — บันทึก icons
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
      { success: false, message: "ต้องส่ง array ของ icons อย่างน้อย 1 รายการ" },
      { status: 400 }
    );
  }

  // ตรวจข้อมูล
  const errors: string[] = [];
  const items: IconInput[] = [];
  raw.forEach((item, i) => {
    const { value, error } = validate(item, i);
    if (error) errors.push(error);
    else if (value) items.push(value);
  });

  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 400 });
  }

  // ตัด iconUrl ที่ซ้ำกันใน request เดียวกัน
  const unique = [...new Map(items.map((i) => [i.iconUrl, i])).values()];

  try {
    await connectDB();

    // ถ้ามีการอ้างถึง iconSet ต้องมี iconSet นั้นอยู่จริง
    const setIds = [...new Set(unique.filter((i) => i.iconSet).map((i) => i.iconSet!))];
    if (setIds.length > 0) {
      const found = await IconSet.countDocuments({ _id: { $in: setIds } });
      if (found !== setIds.length) {
        return NextResponse.json(
          { success: false, message: "มี iconSet บางตัวที่ไม่พบในระบบ" },
          { status: 404 }
        );
      }
    }

    // Upsert: ถ้ามี iconUrl อยู่แล้วให้อัปเดต ถ้ายังไม่มีให้เพิ่มใหม่
    const ops: AnyBulkWriteOperation<IIcon>[] = unique.map((item) => ({
      updateOne: {
        filter: { iconUrl: item.iconUrl },
        update: {
          $set: {
            iconRole: item.iconRole,
            ...(item.iconSet ? { iconSet: new Types.ObjectId(item.iconSet) } : {}),
          },
        },
        upsert: true,
      },
    }));

    const result = await Icon.bulkWrite(ops, { ordered: false });

    const saved = await Icon.find({ iconUrl: { $in: unique.map((i) => i.iconUrl) } }).lean();

    // ผูก icon เข้ากับ iconSet (ใช้ $addToSet เพื่อไม่ให้ซ้ำ)
    const bySet = new Map<string, Types.ObjectId[]>();
    for (const icon of saved) {
      if (!icon.iconSet) continue;
      const key = icon.iconSet.toString();
      bySet.set(key, [...(bySet.get(key) ?? []), icon._id]);
    }
    await Promise.all(
      [...bySet].map(([setId, ids]) =>
        IconSet.updateOne({ _id: setId }, { $addToSet: { icon: { $each: ids } } })
      )
    );

    return NextResponse.json(
      {
        success: true,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        total: saved.length,
        data: saved.map((i) => ({
          iconId: i._id,
          iconUrl: i.iconUrl,
          iconRole: i.iconRole,
          iconSet: i.iconSet ?? null,
          createAt: i.createAt,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/icons]", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดที่ server" },
      { status: 500 }
    );
  }
}

// GET /api/icons?role=fool — ดึง icons (กรองตาม role ได้)
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const role = req.nextUrl.searchParams.get("role");
    const filter = role ? { iconRole: role.toLowerCase() } : {};

    const icons = await Icon.find(filter).sort({ createAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      total: icons.length,
      data: icons.map((i) => ({
        iconId: i._id,
        iconUrl: i.iconUrl,
        iconRole: i.iconRole,
        iconSet: i.iconSet ?? null,
        createAt: i.createAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/icons]", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดที่ server" },
      { status: 500 }
    );
  }
}