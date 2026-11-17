"use client";

import { useEffect, useState, useMemo } from "react";

type Icon = {
  iconId: string;
  iconUrl: string;
  iconRole: string;
};

type IconSet = {
  iconSetId: string;
  iconSetName: string;
  createAt: string;
  icons: Icon[];
};

export default function IconSetsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iconSets, setIconSets] = useState<IconSet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchIconSets();
  }, []);

  const fetchIconSets = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/icon-sets",
        {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer 55565`,
        }
      }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");

      setIconSets(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // กรอง Icon Sets ตามคำค้นหา (ค้นจากชื่อเซ็ต หรือ Role ของไอคอนข้างใน)
  const filteredIconSets = useMemo(() => {
    return iconSets.filter((set) => {
      const matchName = set.iconSetName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = set.icons.some((icon) =>
        icon.iconRole.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return matchName || matchRole;
    });
  }, [iconSets, searchQuery]);

  return (
    <main className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Icon Sets Directory</h1>
            <p className="text-sm text-zinc-500 mt-1">รายการชุดไอคอน (Bundle) ทั้งหมดในระบบ</p>
          </div>
          <button
            onClick={fetchIconSets}
            className="self-start sm:self-auto text-xs bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 font-medium px-4 py-2 rounded-lg transition-colors"
          >
            รีเฟรชข้อมูล
          </button>
        </div>

        {/* Search Box */}
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาด้วยชื่อ Bundle หรือ Role..."
            className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16 text-sm text-zinc-400">กำลังโหลดข้อมูล Icon Sets...</div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
            {error}
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-6">
            {filteredIconSets.length === 0 ? (
              <p className="text-sm text-zinc-400 py-16 text-center">ไม่พบ Icon Set ที่ตรงกับการค้นหา</p>
            ) : (
              filteredIconSets.map((set) => (
                <div
                  key={set.iconSetId}
                  className="border border-zinc-200 rounded-xl p-6 bg-white shadow-sm space-y-4"
                >
                  {/* Set Header */}
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <div>
                      <h2 className="font-semibold text-lg text-zinc-900">{set.iconSetName}</h2>
                      <p className="text-xs text-zinc-400 font-mono">ID: {set.iconSetId}</p>
                    </div>
                    <span className="text-xs bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full font-medium">
                      {set.icons.length} ไอคอนในเซ็ต
                    </span>
                  </div>

                  {/* Icons Grid inside Set */}
                  {set.icons.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-4 text-center">ยังไม่มีไอคอนในเซ็ตนี้</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      {set.icons.map((icon) => (
                        <div
                          key={icon.iconId}
                          className="group border border-zinc-200 rounded-lg p-3 flex flex-col items-center justify-between gap-3 bg-zinc-50/50 hover:border-zinc-400 transition-all"
                        >
                          <div className="w-14 h-14 relative flex items-center justify-center">
                            <img
                              src={icon.iconUrl}
                              alt={icon.iconRole}
                              className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <div className="w-full text-center space-y-1">
                            <span className="inline-block text-[10px] font-medium text-zinc-600 bg-white border border-zinc-200 px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-full">
                              {icon.iconRole}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </main>
  );
}