import { NextRequest, NextResponse } from "next/server";
import { Types, type AnyBulkWriteOperation } from "mongoose";
import { connectDB } from "@/app/lib/mongodb";
import { Icon, type IIcon } from "@/app/models/Icon";
import { IconSet } from "@/app/models/IconSet";
import { User, type IUser } from "@/app/models/User";
import { verifyApiAuth } from "@/app/lib/auth"; 

type UserInput = { username: string; iconUrl: string };
type Skipped = UserInput & { reason: string };
type PopulatedIcon = Pick<IIcon, "_id" | "iconUrl" | "iconRole">;

const LOOKUP_CONCURRENCY = 8; // จำนวนครั้งที่เรียก API ภายนอกพร้อมกัน



// ... โค้ดเดิม ...



/* ------------------------------------------------------------------
 * หา userId จาก "ข้างนอก" (API ภายนอก) — ไม่ได้ค้นใน database
 * TODO: เขียนเอง
 *  - เจอ   → return userId (string)
 *  - ไม่เจอ → return null
 *  - error → throw ได้เลย (route จะนับเป็น userNotFound แล้วทำรายการอื่นต่อ)
 * ------------------------------------------------------------------ */
async function findUserId(username: string): Promise<string | null> {
  // ตัวอย่าง:
//   const res = await fetch(`https://api.wolvesville.com/players/search?username=${username}`, {
//     headers: { Authorization: process.env.USER_LOOKUP_API_KEY ?? "" },
//     cache: "no-store",
//     signal: AbortSignal.timeout(10_000),
//   });

  const url = `https://api.wolvesville.com/players/search?username=${username}`
  const res = await fetch(url, {
      method: "GET", 
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `bot ${process.env.WW_KEY ?? ""}`
      }
    });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
  const data = await res.json();
  return data?.id ?? null;

  return null;
}

function validate(item: unknown, index: number): { value?: UserInput; error?: string } {
  if (typeof item !== "object" || item === null) {
    return { error: `data[${index}] ต้องเป็น object` };
  }
  const { username, iconUrl } = item as Record<string, unknown>;

  if (typeof username !== "string" || !username.trim()) {
    return { error: `data[${index}].username ต้องเป็น string และห้ามว่าง` };
  }
  if (typeof iconUrl !== "string" || !iconUrl.trim()) {
    return { error: `data[${index}].iconUrl ต้องเป็น string และห้ามว่าง` };
  }
  try {
    new URL(iconUrl.trim());
  } catch {
    return { error: `data[${index}].iconUrl ไม่ใช่ URL ที่ถูกต้อง` };
  }

  return { value: { username: username.trim(), iconUrl: iconUrl.trim() } };
}

// ถ้า username หรือ iconUrl ซ้ำ → ตัดทิ้งทั้งคู่
function removeDuplicates(items: UserInput[]) {
  const nameKey = (u: UserInput) => u.username.toLowerCase();
  const nameCount = new Map<string, number>();
  const urlCount = new Map<string, number>();

  for (const u of items) {
    nameCount.set(nameKey(u), (nameCount.get(nameKey(u)) ?? 0) + 1);
    urlCount.set(u.iconUrl, (urlCount.get(u.iconUrl) ?? 0) + 1);
  }

  const unique: UserInput[] = [];
  const duplicates: Skipped[] = [];

  for (const u of items) {
    const reasons: string[] = [];
    if (nameCount.get(nameKey(u))! > 1) reasons.push("username ซ้ำ");
    if (urlCount.get(u.iconUrl)! > 1) reasons.push("iconUrl ซ้ำ");

    if (reasons.length > 0) duplicates.push({ ...u, reason: reasons.join(", ") });
    else unique.push(u);
  }

  return { unique, duplicates };
}

// เรียก async function แบบจำกัดจำนวนพร้อมกัน (กันโดน rate limit ของ API ภายนอก)
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function formatUser(u: { userId: string; username: string; icons: PopulatedIcon[] }) {
  return {
    userId: u.userId,
    username: u.username,
    totalIcons: u.icons.length,
    icons: u.icons.map((i) => ({ iconId: i._id, iconUrl: i.iconUrl, iconRole: i.iconRole })),
  };
}

// POST /api/users — บันทึก users
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
      { success: false, message: "ต้องส่ง array ของ users อย่างน้อย 1 รายการ" },
      { status: 400 }
    );
  }

  // 1) รับข้อมูล + ตรวจความถูกต้อง
  const errors: string[] = [];
  const items: UserInput[] = [];
  raw.forEach((item, i) => {
    const { value, error } = validate(item, i);
    if (error) errors.push(error);
    else if (value) items.push(value);
  });
  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 400 });
  }

  // 2) username หรือ iconUrl ซ้ำ → ตัดทิ้งทั้งคู่
  const { unique, duplicates } = removeDuplicates(items);

  const iconNotFound: Skipped[] = [];
  const userNotFound: Skipped[] = [];

  try {
    await connectDB();

    // 3) ค้นหา iconUrl ใน icons.iconUrl
    const icons = await Icon.find({ iconUrl: { $in: unique.map((u) => u.iconUrl) } })
      .select("_id iconUrl iconSet")
      .lean();
    const iconByUrl = new Map(icons.map((i) => [i.iconUrl, i]));

    const withIcon = unique.filter((u) => {
      if (iconByUrl.has(u.iconUrl)) return true;
      iconNotFound.push({ ...u, reason: "ไม่พบ iconUrl ใน icons" });
      return false;
    });

    // 4) เจอ icon → หา userId จากข้างนอก
    const lookups = await mapLimit(withIcon, LOOKUP_CONCURRENCY, async (u) => {
      try {
        return { ...u, userId: await findUserId(u.username) };
      } catch (err) {
        console.error(`[findUserId] ${u.username}`, err);
        return { ...u, userId: null };
      }
    });

    const found = lookups.filter((u): u is UserInput & { userId: string } => {
      if (u.userId) return true;
      userNotFound.push({ username: u.username, iconUrl: u.iconUrl, reason: "ไม่พบ userId" });
      return false;
    });

    // 5) ถ้า icon มี iconSet → ดึง iconSets.icon ทั้งหมดมาด้วย
    const setIds = [
      ...new Set(
        found
          .map((u) => iconByUrl.get(u.iconUrl)!.iconSet?.toString())
          .filter((id): id is string => !!id)
      ),
    ];
    const sets = setIds.length
      ? await IconSet.find({ _id: { $in: setIds } }).select("icon").lean()
      : [];
    const setIconsById = new Map(sets.map((s) => [s._id.toString(), s.icon]));

    // 6) รวม icon ที่จะใส่ให้แต่ละ user
    const toSave = new Map<string, { username: string; icons: Map<string, Types.ObjectId> }>();

    for (const u of found) {
      const icon = iconByUrl.get(u.iconUrl)!;
      const entry = toSave.get(u.userId) ?? { username: u.username, icons: new Map() };
      entry.username = u.username;

      entry.icons.set(icon._id.toString(), icon._id); // icon ที่ส่งมา

      if (icon.iconSet) {
        for (const id of setIconsById.get(icon.iconSet.toString()) ?? []) {
          entry.icons.set(id.toString(), id); // icon ทั้งเซ็ต
        }
      }

      toSave.set(u.userId, entry);
    }

    // 7) เจอ userId → บันทึก (upsert ตาม userId, icons ไม่ซ้ำ)
    let inserted = 0;
    let updated = 0;

    if (toSave.size > 0) {
      const ops: AnyBulkWriteOperation<IUser>[] = [...toSave].map(([userId, e]) => ({
        updateOne: {
          filter: { userId },
          update: {
            $set: { username: e.username },
            $addToSet: { icons: { $each: [...e.icons.values()] } },
          },
          upsert: true,
        },
      }));

      const result = await User.bulkWrite(ops, { ordered: false });
      inserted = result.upsertedCount;
      updated = result.modifiedCount;
    }

    const saved = toSave.size
      ? await User.find({ userId: { $in: [...toSave.keys()] } })
          .populate<{ icons: PopulatedIcon[] }>("icons", "iconUrl iconRole")
          .lean()
      : [];

    return NextResponse.json(
      {
        success: true,
        received: items.length,
        saved: saved.length,
        inserted,
        updated,
        data: saved.map(formatUser),
        skipped: { duplicates, iconNotFound, userNotFound },
      },
      { status: inserted > 0 ? 201 : 200 }
    );
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดที่ server" },
      { status: 500 }
    );
  }
}

// GET /api/users?username=DOBBY_ — ดึง users ที่บันทึกไว้แล้วพร้อม icons
export async function GET(req: NextRequest) {

    const authError = verifyApiAuth(req);
  if (authError) return authError;

  try {
    await connectDB();
    const username = req.nextUrl.searchParams.get("username");
    const filter = username ? { username } : {};

    const users = await User.find(filter)
      .populate<{ icons: PopulatedIcon[] }>("icons", "iconUrl iconRole")
      .lean();

    return NextResponse.json({ success: true, total: users.length, data: users.map(formatUser) });
  } catch (err) {
    console.error("[GET /api/users]", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดที่ server" },
      { status: 500 }
    );
  }
}