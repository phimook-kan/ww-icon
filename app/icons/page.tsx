"use client";

import { useEffect, useState, useMemo } from "react";

type Icon = {
  iconId: string;
  iconUrl: string;
  iconRole: string;
  iconSet?: string | null;
  createAt: string;
};

export default function IconsByCategoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [icons, setIcons] = useState<Icon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  useEffect(() => {
    fetchIcons();
  }, []);

  const fetchIcons = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/icons",
        {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer 55565`,
        }
      }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");

      setIcons(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ดึงรายชื่อ Role ทั้งหมดมาทำเป็นตัวกรอง (Filter buttons)
  const roles = useMemo(() => {
    const roleSet = new Set(icons.map((i) => i.iconRole.toLowerCase()));
    return ["all", ...Array.from(roleSet)].sort();
  }, [icons]);

  // กรองไอคอนตามคำค้นหาและ Role ที่เลือก
  const filteredIcons = useMemo(() => {
    return icons.filter((icon) => {
      const matchesSearch =
        icon.iconRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        icon.iconId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === "all" || icon.iconRole.toLowerCase() === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [icons, searchQuery, selectedRole]);

  // จัดกลุ่มไอคอนตาม iconRole เพื่อแสดงผลแยกตามหมวดหมู่
  const groupedIcons = useMemo(() => {
    const map = new Map<string, Icon[]>();
    filteredIcons.forEach((icon) => {
      const role = icon.iconRole.toLowerCase();
      if (!map.has(role)) map.set(role, []);
      map.get(role)!.push(icon);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredIcons]);

  return (
    <main className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Icons Directory</h1>
            <p className="text-sm text-zinc-500 mt-1">รายการไอคอนทั้งหมดในระบบ จัดหมวดหมู่ตามบทบาท (Role)</p>
          </div>
          <button
            onClick={fetchIcons}
            className="self-start sm:self-auto text-xs bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 font-medium px-4 py-2 rounded-lg transition-colors"
          >
            รีเฟรชข้อมูล
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาด้วย Role หรือ ID..."
            className="flex-1 bg-zinc-50 border border-zinc-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-900 transition-colors"
          />

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 max-w-full">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium uppercase tracking-wider whitespace-nowrap transition-colors ${
                  selectedRole === role
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16 text-sm text-zinc-400">กำลังโหลดไอคอน...</div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
            {error}
          </div>
        )}

        {/* Content categorized by Role */}
        {!loading && !error && (
          <div className="space-y-10">
            {groupedIcons.length === 0 ? (
              <p className="text-sm text-zinc-400 py-16 text-center">ไม่พบไอคอนที่ตรงกับการค้นหา</p>
            ) : (
              groupedIcons.map(([role, roleIcons]) => (
                <section key={role} className="space-y-4">
                  {/* Category Title */}
                  <div className="flex items-center gap-3 border-b border-zinc-100 pb-2">
                    <h2 className="text-base font-semibold uppercase tracking-wider text-zinc-800">
                      {role}
                    </h2>
                    <span className="text-xs bg-zinc-100 border border-zinc-200 text-zinc-500 px-2.5 py-0.5 rounded-full font-medium">
                      {roleIcons.length}
                    </span>
                  </div>

                  {/* Icons Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {roleIcons.map((icon) => (
                      <div
                        key={icon.iconId}
                        className="group border border-zinc-200 rounded-xl p-3 flex flex-col items-center justify-between gap-3 bg-zinc-50/50 hover:border-zinc-400 transition-all"
                      >
                        <div className="w-16 h-16 relative flex items-center justify-center">
                          <img
                            src={icon.iconUrl}
                            alt={icon.iconRole}
                            className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="w-full text-center space-y-1">
                          <span className="block text-[10px] font-mono text-zinc-400 truncate">
                            {icon.iconId}
                          </span>
                          {/* <a
                            href={icon.iconUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-zinc-600 hover:underline block truncate"
                          >
                            เปิดลิงก์รูป
                          </a> */}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

      </div>
    </main>
  );
}