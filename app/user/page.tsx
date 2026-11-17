"use client";

import { useEffect, useState } from "react";

type Icon = {
  iconId: string;
  iconUrl: string;
  iconRole: string;
};

type UserData = {
  userId: string;
  username: string;
  totalIcons: number;
  icons: Icon[];
};

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // โหลดข้อมูลทุกคนเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/users", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer 55565`,
        }
      }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");

      setUsers(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // กรองรายชื่อจากช่องค้นหา (Real-time)
  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">All User Icons Directory</h1>
            <p className="text-sm text-zinc-500 mt-1">แสดงรายการไอคอนทั้งหมดของผู้เล่นทุกคนในระบบ</p>
          </div>
          <button
            onClick={fetchUsers}
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
            placeholder="ค้นหาด้วย Username..."
            className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-900 transition-colors"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 text-sm text-zinc-400">กำลังโหลดข้อมูล...</div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
            {error}
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <div className="space-y-6">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-zinc-400 py-12 text-center">ไม่พบผู้ใช้งานที่ค้นหา</p>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.userId}
                  className="border border-zinc-200 rounded-xl p-6 bg-white shadow-sm space-y-4"
                >
                  {/* User Info */}
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <div>
                      <h2 className="font-semibold text-lg">{user.username}</h2>
                      <p className="text-xs text-zinc-400 font-mono">ID: {user.userId}</p>
                    </div>
                    <span className="text-xs bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full font-medium">
                      {user.totalIcons} ไอคอน
                    </span>
                  </div>

                  {/* Icons Grid */}
                  {user.icons.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-4 text-center">ยังไม่มีไอคอนในครอบครอง</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-8 gap-3">
                      {user.icons.map((icon) => (
                        <div
                          key={icon.iconId}
                          className="group border border-zinc-200 rounded-lg p-3 flex flex-col items-center gap-2 bg-zinc-50/50 hover:border-zinc-400 transition-all"
                        >
                          <div className="w-14 h-14 relative flex items-center justify-center">
                            <img
                              src={icon.iconUrl}
                              alt={icon.iconRole}
                              className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <span className="text-xs font-medium text-zinc-600 bg-white border border-zinc-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {icon.iconRole}
                          </span>
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