import React, { useEffect, useMemo, useState } from 'react';

// ===== CONFIG =====
const API_URL =
  'https://script.google.com/macros/s/AKfycbyaN7w176IOfHqY3n21NZmvHIVK1fChGzG3Z07MhIK0GXvIw0Vd_fsrTtZd7bARS1_JTw/exec';

const MAX_PER_DAY = 4;
const BOOK_FROM_OFFSET_DAYS = 1; // T+1
const MAX_BOOKING_DAYS = 7;
const END_DATE = '2026-05-02'; // strict lock
const ADMIN_KEY = 'DOSMOOVADMIN';

const TIME_SLOTS = [
  '09:15 YOGALATES',
  '09:15 POWER FLOW',
  '10:30 STRETCH AND SOUND',
  '10:30 MOBILITY',
  '18:10 POWER FLOW',
  '18:10 MAT PILATES',
  '18:10 YOGA FOR OFFICE SYNDROME',
  '18:10 INSIDE FLOW',
  '18:10 ZUMBA',
  '18:10 BARRE',
  '19:15 GENTLE FLOW',
  '19:15 YOGA FOR OFFICE SYNDROME',
  '19:15 STRETCH AND SOUND',
  '19:15 BARRE',
  '19:15 ZUMBA',
  'GYM   เล่นเครื่อง',
];

// ===== TYPES =====
type RegRow = {
  id: string;
  user: string;
  date: string;
  time: string;
  createdAt?: string;
};

// ===== HELPERS =====
const normalizeUserName = (name: string | null | undefined) =>
  String(name || '').trim().toLowerCase();

const parseSlot = (s: string) => {
  const m = s.match(/^(\d{2}:\d{2})\s+(.*)$/);
  return {
    time: m ? m[1] : s.slice(0, 5),
    name: m ? m[2] : s.slice(6).trim(),
  };
};

const slotTime = (slot: string) => parseSlot(slot).time;

const timeToMin = (t: string) => {
  const m = String(t).match(/(\d{2}):(\d{2})/);
  if (!m) return 99999;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const sortByTimeAsc = (slots: string[]) =>
  [...slots].sort((a, b) => timeToMin(slotTime(a)) - timeToMin(slotTime(b)));

const toYMDLocal = (dt: Date) => {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toYMD = (v: unknown) => {
  if (!v) return '';
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatTimes = (v: unknown) => {
  if (!v) return [];
  return String(v)
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
};

const startOfLocalDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const parseLocalYMD = (ymd: string) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const getMinBookDate = () =>
  toYMDLocal(addDays(startOfLocalDay(new Date()), BOOK_FROM_OFFSET_DAYS));

const getEndBookDate = () =>
  toYMDLocal(startOfLocalDay(parseLocalYMD(END_DATE)));

const isDateBeforeMin = (ymd: string) => ymd < getMinBookDate();
const isDateAfterEnd = (ymd: string) => ymd > getEndBookDate();

const isBookableDate = (ymd: string) => {
  if (!ymd) return false;
  return !isDateBeforeMin(ymd) && !isDateAfterEnd(ymd);
};

const clampSelectedDate = (ymd: string) => {
  const min = getMinBookDate();
  const end = getEndBookDate();

  if (min > end) return min;
  if (!ymd || ymd < min) return min;
  if (ymd > end) return end;
  return ymd;
};

const isValidSlot = (slot: string) => TIME_SLOTS.includes(slot);

const dayNameTH = (date: Date) =>
  ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][date.getDay()];

const getUniqueUsersByDate = (rows: RegRow[], date: string) => {
  const names = rows
    .filter((r) => toYMD(r.date) === date)
    .map((r) => normalizeUserName(r.user))
    .filter(Boolean);

  return [...new Set(names)];
};

const dashboardCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
  backdropFilter: 'blur(8px)',
};

const dashboardLabelStyle: React.CSSProperties = {
  color: '#9fb0c8',
  fontSize: 12,
  marginBottom: 8,
};

const dashboardValueStyle: React.CSSProperties = {
  color: 'white',
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.1,
};

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => getMinBookDate());
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');

  const styles: Record<string, React.CSSProperties> = {
    app: {
      minHeight: '100vh',
      background:
        'radial-gradient(circle at top left, rgba(0,255,128,0.18), transparent 28%), radial-gradient(circle at top right, rgba(249,115,22,0.14), transparent 24%), linear-gradient(135deg, #081221 0%, #0f172a 48%, #111827 100%)',
      padding: 16,
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: 'white',
    },
    pageWrap: {
      maxWidth: 1180,
      margin: '0 auto',
    },
    card: {
      background: 'rgba(255,255,255,0.08)',
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 12px 36px rgba(0,0,0,0.16)',
      backdropFilter: 'blur(10px)',
    },
    heroCard: {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
      borderRadius: 26,
      padding: 20,
      marginBottom: 16,
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
      backdropFilter: 'blur(12px)',
    },
    input: {
      width: '100%',
      padding: 14,
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.15)',
      background: 'rgba(255,255,255,0.08)',
      color: 'white',
      fontSize: 15,
      boxSizing: 'border-box',
      outline: 'none',
    },
    btnPrimary: {
      border: 'none',
      borderRadius: 14,
      padding: '14px 18px',
      cursor: 'pointer',
      color: 'white',
      fontWeight: 800,
      fontSize: 14,
      background: 'linear-gradient(90deg, #00c853, #10b981)',
      boxShadow: '0 8px 24px rgba(16,185,129,0.22)',
    },
    btnAccent: {
      border: 'none',
      borderRadius: 14,
      padding: '14px 18px',
      cursor: 'pointer',
      color: 'white',
      fontWeight: 800,
      fontSize: 14,
      background: 'linear-gradient(90deg, #f97316, #ef4444)',
      boxShadow: '0 8px 24px rgba(239,68,68,0.22)',
    },
    btnGhost: {
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12,
      padding: '12px 14px',
      cursor: 'pointer',
      color: 'white',
      fontWeight: 700,
      fontSize: 14,
      background: 'rgba(255,255,255,0.05)',
    },
    syncBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      background: syncing ? 'rgba(234,179,8,0.16)' : 'rgba(34,197,94,0.16)',
      color: syncing ? '#fde047' : '#86efac',
      borderRadius: 999,
      fontSize: 12,
      border: '1px solid rgba(255,255,255,0.08)',
    },
    sectionTitle: {
      color: '#eef7ff',
      fontWeight: 800,
      fontSize: 17,
      margin: 0,
    },
    sectionSub: {
      color: '#9fb0c8',
      fontSize: 12,
      lineHeight: 1.5,
    },
  };

  const userBookedSlotsOnSelectedDate = useMemo(
    () =>
      new Set(
        regs
          .filter(
            (r) =>
              normalizeUserName(r.user) === normalizeUserName(user || '') &&
              toYMD(r.date) === selectedDate
          )
          .flatMap((r) => formatTimes(r.time))
      ),
    [regs, user, selectedDate]
  );

  const isSlotAlreadyBookedByCurrentUser = (slot: string) =>
    userBookedSlotsOnSelectedDate.has(slot);

  const toggleTime = (slot: string) => {
    if (!isBookableDate(selectedDate)) return;
    if (!isValidSlot(slot)) return;
    if (isSlotAlreadyBookedByCurrentUser(slot)) return;

    const t = slotTime(slot);

    setSelectedTimes((prev) => {
      if (prev.includes(slot)) return prev.filter((x) => x !== slot);

      const withoutSameTime = prev.filter((x) => slotTime(x) !== t);
      const next = [...withoutSameTime, slot].filter(isValidSlot);
      return sortByTimeAsc(next);
    });
  };

  const loadData = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_URL}?action=getAll`);
      const result = await response.json();
      if (result.success) {
        setRegs(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('fitnessUser');
    if (savedUser) setUser(savedUser);
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fixed = clampSelectedDate(selectedDate);
    if (fixed !== selectedDate) {
      setSelectedDate(fixed);
      setSelectedTimes([]);
    }
  }, [selectedDate]);

  useEffect(() => {
    setSelectedTimes((prev) => prev.filter(isValidSlot));
  }, [selectedDate, regs]);

  const selectedDateRegs = useMemo(
    () => regs.filter((r) => toYMD(r.date) === selectedDate),
    [regs, selectedDate]
  );

  const selectedDateUniqueUsers = useMemo(
    () => getUniqueUsersByDate(regs, selectedDate),
    [regs, selectedDate]
  );

  const bookingWindowClosed = getMinBookDate() > getEndBookDate();
  const isBookable = !bookingWindowClosed && isBookableDate(selectedDate);
  const isCurrentUserAlreadyCounted = selectedDateUniqueUsers.includes(
    normalizeUserName(user || '')
  );
  const uniqueUserCountToday = selectedDateUniqueUsers.length;
  const isFull = uniqueUserCountToday >= MAX_PER_DAY && !isCurrentUserAlreadyCounted;

  const alreadyBookedSameSlot = selectedTimes.some((slot) =>
    isSlotAlreadyBookedByCurrentUser(slot)
  );

  const todayCount = uniqueUserCountToday;
  const occupancyPercent = Math.round((todayCount / MAX_PER_DAY) * 100);

  const slotSummary = useMemo(() => {
    return TIME_SLOTS.map((slot) => ({
      slot,
      count: regs.filter((r) => formatTimes(r.time).includes(slot)).length,
    })).sort((a, b) => b.count - a.count);
  }, [regs]);

  const topUsers = useMemo(() => {
    const map = new Map<string, number>();
    regs.forEach((r) => {
      const key = r.user?.trim() || '-';
      map.set(key, (map.get(key) || 0) + 1);
    });

    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [regs]);

  const uniqueUsers = useMemo(() => {
    return new Set(regs.map((r) => r.user?.trim()).filter(Boolean)).size;
  }, [regs]);

  const getWeekDates = () => {
    const dates: string[] = [];
    const start = addDays(startOfLocalDay(new Date()), BOOK_FROM_OFFSET_DAYS);
    const end = startOfLocalDay(parseLocalYMD(END_DATE));

    if (start > end) return [];

    for (let i = 0; i < MAX_BOOKING_DAYS; i++) {
      const d = addDays(start, i);
      if (d > end) break;
      dates.push(toYMDLocal(d));
    }

    return dates;
  };

  const handleLogin = () => {
    if (!loginInput.trim()) return;
    const clean = loginInput.trim();
    setUser(clean);
    localStorage.setItem('fitnessUser', clean);
    setLoginInput('');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('fitnessUser');
    setAdminMode(false);
    setAdminKeyInput('');
  };

  const handleBook = async () => {
    if (loading || !user) return;
    if (bookingWindowClosed) {
      alert(`❌ หมดช่วงเปิดจองแล้ว (เปิดจองได้ถึง ${END_DATE})`);
      return;
    }

    const safeDate = clampSelectedDate(selectedDate);
    const safeTimes = sortByTimeAsc(selectedTimes.filter(isValidSlot));

    if (!isBookableDate(safeDate)) {
      alert('❌ สามารถจองได้ตั้งแต่วันถัดไป (T+1) เท่านั้น');
      setSelectedDate(getMinBookDate());
      setSelectedTimes([]);
      return;
    }

    if (safeTimes.length === 0) {
      alert('❌ กรุณาเลือกเวลา');
      return;
    }

    const dayUniqueUsers = getUniqueUsersByDate(regs, safeDate);
    const currentUserAlreadyCounted = dayUniqueUsers.includes(
      normalizeUserName(user || '')
    );
    const fullNow =
      dayUniqueUsers.length >= MAX_PER_DAY && !currentUserAlreadyCounted;

    const duplicatedSlots = safeTimes.filter((slot) =>
      regs.some(
        (r) =>
          normalizeUserName(r.user) === normalizeUserName(user || '') &&
          toYMD(r.date) === safeDate &&
          formatTimes(r.time).includes(slot)
      )
    );

    if (fullNow) {
      alert('❌ วันนี้เต็มแล้ว');
      return;
    }

    if (duplicatedSlots.length > 0) {
      alert('❌ คุณจองเวลาเดิมในวันเดียวกันซ้ำไม่ได้');
      return;
    }

    setLoading(true);

    const id = Date.now().toString();
    const timeStr = safeTimes.join(' | ');

    try {
      const params = new URLSearchParams({
        action: 'add',
        id,
        user: user.trim(),
        date: safeDate,
        time: timeStr,
      });

      const response = await fetch(`${API_URL}?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setRegs((prev) => [
          ...prev,
          {
            id,
            user: user.trim(),
            date: safeDate,
            time: timeStr,
            createdAt: new Date().toISOString(),
          },
        ]);

        setSelectedDate(safeDate);
        setSelectedTimes([]);
        alert('✅ ลงทะเบียนสำเร็จ!');
      } else {
        alert('❌ ' + (result.error || 'ลงทะเบียนไม่สำเร็จ'));
      }
    } catch (error) {
      alert('❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('ยืนยันยกเลิก?')) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}?action=delete&id=${encodeURIComponent(id)}`
      );
      const result = await response.json();

      if (result.success) {
        setRegs((prev) => prev.filter((r) => String(r.id) !== String(id)));
        alert('✅ ยกเลิกแล้ว');
      } else {
        alert('❌ ' + (result.error || 'ยกเลิกไม่สำเร็จ'));
      }
    } catch (error) {
      alert('❌ เกิดข้อผิดพลาด');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['id', 'user', 'date', 'time', 'createdAt'],
      ...regs.map((r) => [r.id, r.user, r.date, r.time, r.createdAt || '']),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness_report_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loginAdmin = () => {
    if (adminKeyInput === ADMIN_KEY) {
      setAdminMode(true);
      setAdminKeyInput('');
      return;
    }
    alert('❌ Admin Key ไม่ถูกต้อง');
  };

  if (!user) {
    return (
      <div style={styles.app}>
        <div
          style={{
            maxWidth: 460,
            margin: '0 auto',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0',
          }}
        >
          <div
            style={{
              ...styles.heroCard,
              width: '100%',
              padding: 22,
              borderRadius: 28,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #00c853, #009688)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: 12,
                  boxShadow: '0 12px 28px rgba(0, 200, 83, 0.32)',
                  flexShrink: 0,
                }}
              >
                <img
  src="/logo_dos.png"
  alt="DOS Logo"
  style={{
    width: 68,
    height: 68,
    borderRadius: 20,
    objectFit: 'contain',
    background: 'white',
    padding: 8,
    boxShadow: '0 12px 28px rgba(0, 200, 83, 0.22)',
    flexShrink: 0,
  }}
/>
              </div>
  
              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: 24,
                    lineHeight: 1.15,
                    margin: 0,
                    color: 'white',
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                  }}
                >
                  DOS x MOOV Fitness
                </h1>
                <p
                  style={{
                    color: '#9fb0c8',
                    margin: '8px 0 0 0',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  ลงทะเบียนใช้งาน Fitness แบบ premium experience
                </p>
              </div>
            </div>
  
            <div
              style={{
                ...styles.card,
                marginBottom: 0,
                padding: 20,
                borderRadius: 24,
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    color: 'white',
                    fontSize: 18,
                    fontWeight: 800,
                    marginBottom: 4,
                  }}
                >
                  เข้าสู่ระบบ
                </div>
                <div
                  style={{
                    color: '#9fb0c8',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  โปรดใช้ชื่อเดิมทุกครั้งเพื่อให้ระบบนับสิทธิ์ได้ถูกต้อง
                </div>
              </div>
  
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 12,
                }}
              >
                <input
                  style={{
                    ...styles.input,
                    height: 52,
                    borderRadius: 16,
                    textAlign: 'center',
                    fontSize: 15,
                  }}
                  placeholder="พิมพ์ชื่อของคุณ..."
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
  
                <button
                  onClick={handleLogin}
                  style={{
                    ...styles.btnAccent,
                    width: '100%',
                    height: 54,
                    borderRadius: 16,
                    fontSize: 16,
                    fontWeight: 900,
                  }}
                >
                  🔑 เข้าสู่ระบบ
                </button>
              </div>
  
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    ...dashboardCardStyle,
                    padding: 14,
                    textAlign: 'center',
                  }}
                >
                  <div style={dashboardLabelStyle}>Capacity / วัน</div>
                  <div style={dashboardValueStyle}>{MAX_PER_DAY}</div>
                </div>
  
                <div
                  style={{
                    ...dashboardCardStyle,
                    padding: 14,
                    textAlign: 'center',
                  }}
                >
                  <div style={dashboardLabelStyle}>Booking Rule</div>
                  <div style={{ ...dashboardValueStyle, fontSize: 22 }}>T+1</div>
                </div>
  
                <div
                  style={{
                    ...dashboardCardStyle,
                    padding: 14,
                    textAlign: 'center',
                  }}
                >
                  <div style={dashboardLabelStyle}>Status</div>
                  <div
                    style={{
                      ...dashboardValueStyle,
                      fontSize: 22,
                      color: '#86efac',
                    }}
                  >
                    Online
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.pageWrap}>
        <div style={styles.heroCard}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, #00c853, #009688)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: 12,
                  boxShadow: '0 12px 28px rgba(0, 200, 83, 0.32)',
                  flexShrink: 0,
                }}
              >
                <img
  src="/logo_dos.png"
  alt="DOS Logo"
  style={{
    width: 68,
    height: 68,
    borderRadius: 20,
    objectFit: 'contain',
    background: 'white',
    padding: 8,
    boxShadow: '0 12px 28px rgba(0, 200, 83, 0.22)',
    flexShrink: 0,
  }}
/>
              </div>

              <div>
                <h1 style={{ color: 'white', fontSize: 22, margin: 0 }}>
                  DOS x MOOV Fitness
                </h1>
                <p style={{ color: '#9fb0c8', fontSize: 13, margin: '4px 0 0 0' }}>
                  สวัสดี, {user}
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span style={styles.syncBadge}>
                {syncing ? '🔄 Syncing...' : '☁️ Online'}
              </span>

              <button onClick={loadData} disabled={syncing} style={styles.btnGhost}>
                🔄 รีเฟรช
              </button>

              <button onClick={handleLogout} style={styles.btnGhost}>
                ออก
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
          }}
        >
          {/* 1. เลือกวันที่ */}
          <div style={styles.card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 20 }}>📅</span>
              <div>
                <h2 style={styles.sectionTitle}>เลือกวันที่</h2>
                <div style={styles.sectionSub}>
                  เริ่มจองได้ตั้งแต่วันถัดไป (T+1) และเปิดให้เลือกสูงสุด 7 วัน
                </div>
              </div>
            </div>

            {bookingWindowClosed ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 24,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fca5a5',
                  fontWeight: 700,
                }}
              >
                หมดช่วงเปิดจองแล้ว
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: '#9fb0c8',
                    fontWeight: 500,
                  }}
                >
                  เปิดจองได้ถึงวันที่ {END_DATE}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(82px, 1fr))',
                  gap: 8,
                }}
              >
                {getWeekDates().map((date) => {
                  const d = parseLocalYMD(date);
                  const dayUniqueUsers = getUniqueUsersByDate(regs, date).length;
                  const full = dayUniqueUsers >= MAX_PER_DAY;
                  const selected = date === selectedDate;
                  const disabled = !isBookableDate(date);

                  return (
                    <button
                      key={date}
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        setSelectedDate(date);
                        setSelectedTimes([]);
                      }}
                      style={{
                        padding: 14,
                        borderRadius: 18,
                        border: selected
                          ? '1px solid rgba(255,255,255,0.0)'
                          : '1px solid rgba(255,255,255,0.08)',
                        textAlign: 'center',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        minWidth: 60,
                        opacity: disabled ? 0.35 : 1,
                        background: selected
                          ? 'linear-gradient(90deg, #f97316, #ef4444)'
                          : full
                          ? 'rgba(239,68,68,0.16)'
                          : 'rgba(255,255,255,0.04)',
                        color: selected ? 'white' : full ? '#fca5a5' : 'white',
                        transform: selected ? 'translateY(-2px)' : 'translateY(0)',
                        boxShadow: selected
                          ? '0 12px 28px rgba(239,68,68,0.26)'
                          : 'none',
                      }}
                    >
                      <div style={{ fontSize: 11, opacity: 0.72 }}>
                        {dayNameTH(d)}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                        {d.getDate()}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: full ? '#fca5a5' : '#86efac',
                          fontWeight: 700,
                        }}
                      >
                        {full ? 'เต็ม' : `ว่าง ${MAX_PER_DAY - dayUniqueUsers}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

            {/* 2. Class Guide */}
            <div style={styles.card}>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ ...styles.sectionTitle, marginBottom: 10 }}>
                  📌 Class Guide
                </h2>

                <div style={{ ...styles.sectionSub, lineHeight: 1.9 }}>
                  <div>จ 18:10 POWER FLOW_pong / 19:15 GENTLE FLOW_pong</div>
                  <div>อ 18:10 MAT PILATES_ing หรือ ZUMBA_min</div> 
                  <div>อ 19:15 YOGA for OFFICE SYNDROME_whan หรือ BARRE_ing</div>
                  <div>พ 18:10 BARRE_mhee / 19:15 STRETCH and SOUND_nuch</div>
                  <div>พฤ 18:10 YOGA for OFFICE SYNDROME_dodo / 19:15 GENTLE FLOW_dodo</div>
                  <div>ศ 18:10 INSIDE FLOW_nada / 19:15 ZUMBA_bong</div>
                  <div>ส 18เมย, 25เมย 09:15 YOGALATES_jiji / 10:30 STRETCH and SOUND_jiji</div>
                  <div>ส 2พค 09:15 POWER FLOW_cherry / 10:30 MOBILITY_cherry</div>
                </div>
              </div>
            </div>

          {/* 3. เลือกเวลา */}
          <div style={styles.card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 20 }}>⏰</span>
              <div>
                <h2 style={styles.sectionTitle}>เลือกเวลา</h2>
                <div style={styles.sectionSub}>
                  จองวันเดิมซ้ำได้ แต่เวลาเดิมที่เคยจองแล้วจะกดไม่ได้
                </div>
              </div>
            </div>

            {bookingWindowClosed ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#fca5a5' }}>
                <p style={{ fontSize: 24, margin: 0 }}>📅</p>
                <p style={{ fontSize: 18, fontWeight: 'bold' }}>หมดช่วงเปิดจองแล้ว</p>
                <p style={{ fontSize: 12, color: '#9fb0c8' }}>
                  เปิดจองได้ถึงวันที่ {END_DATE}
                </p>
              </div>
            ) : !isBookable ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#fca5a5' }}>
                <p style={{ fontSize: 24, margin: 0 }}>📅</p>
                <p style={{ fontSize: 18, fontWeight: 'bold' }}>
                  เลือกจองได้ตั้งแต่วันถัดไป (T+1)
                </p>
              </div>
            ) : isFull ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#fca5a5' }}>
                <p style={{ fontSize: 24, margin: 0 }}>❌</p>
                <p style={{ fontSize: 18, fontWeight: 'bold' }}>วันนี้เต็มแล้ว</p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  {TIME_SLOTS.map((slot) => {
                    const { time, name } = parseSlot(slot);
                    const selected = selectedTimes.includes(slot);
                    const alreadyBookedByMe =
                      isSlotAlreadyBookedByCurrentUser(slot);

                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          if (alreadyBookedByMe) return;
                          toggleTime(slot);
                        }}
                        disabled={alreadyBookedByMe}
                        style={{
                          padding: 14,
                          borderRadius: 16,
                          border: selected
                            ? '1px solid rgba(255,255,255,0)'
                            : alreadyBookedByMe
                            ? '1px solid rgba(255,255,255,0.08)'
                            : '1px solid rgba(255,255,255,0.10)',
                          cursor: alreadyBookedByMe ? 'not-allowed' : 'pointer',
                          background: selected
                            ? 'linear-gradient(90deg, #f97316, #ef4444)'
                            : alreadyBookedByMe
                            ? 'rgba(148,163,184,0.22)'
                            : 'rgba(255,255,255,0.04)',
                          color: alreadyBookedByMe
                            ? 'rgba(255,255,255,0.6)'
                            : 'white',
                          textAlign: 'left',
                          boxShadow: selected
                            ? '0 10px 26px rgba(239,68,68,0.24)'
                            : 'none',
                          opacity: alreadyBookedByMe ? 0.7 : 1,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: 15,
                            lineHeight: 1.15,
                          }}
                        >
                          ⏰ {time}
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 12,
                            opacity: 0.92,
                            lineHeight: 1.2,
                            minHeight: 28,
                          }}
                        >
                          {name}
                        </div>

                        {alreadyBookedByMe && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'rgba(255,255,255,0.65)',
                            }}
                          >
                            จองแล้ว
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleBook}
                  disabled={
                    bookingWindowClosed ||
                    !isBookable ||
                    selectedTimes.length === 0 ||
                    loading ||
                    isFull ||
                    alreadyBookedSameSlot
                  }
                  style={{
                    ...styles.btnPrimary,
                    width: '100%',
                    opacity:
                      bookingWindowClosed ||
                      !isBookable ||
                      selectedTimes.length === 0 ||
                      loading ||
                      isFull ||
                      alreadyBookedSameSlot
                        ? 0.5
                        : 1,
                    cursor:
                      bookingWindowClosed ||
                      !isBookable ||
                      selectedTimes.length === 0 ||
                      loading ||
                      isFull ||
                      alreadyBookedSameSlot
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {loading ? '⏳ กำลังบันทึก...' : '✅ ลงทะเบียน'}
                </button>
              </>
            )}
          </div>

          {/* 4. รายชื่อผู้ลงทะเบียน */}
          <div style={styles.card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={styles.sectionTitle}>👥 รายชื่อผู้ลงทะเบียน</h2>
                <div style={styles.sectionSub}>
                  วันที่ {selectedDate} • {uniqueUserCountToday}/{MAX_PER_DAY} คน
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '8px 12px',
                  borderRadius: 999,
                  fontWeight: 800,
                  color: '#e7f4ff',
                }}
              >
                {occupancyPercent}%
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {Array.from({ length: MAX_PER_DAY }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 999,
                    background:
                      i < uniqueUserCountToday
                        ? 'linear-gradient(90deg, #f97316, #ef4444)'
                        : 'rgba(255,255,255,0.12)',
                  }}
                />
              ))}
            </div>

            {selectedDateRegs.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: '#90a4bd',
                  padding: 28,
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                ยังไม่มีผู้ลงทะเบียน
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {selectedDateRegs.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 16,
                      padding: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: 'linear-gradient(90deg, #f97316, #ef4444)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            color: 'white',
                            margin: 0,
                            fontWeight: 800,
                            wordBreak: 'break-word',
                          }}
                        >
                          {r.user}
                        </p>

                        <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                          {sortByTimeAsc(formatTimes(r.time)).map(
                            (line: string, idx: number) => {
                              const { time, name } = parseSlot(line);

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    fontSize: 12,
                                    lineHeight: 1.2,
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  <span style={{ color: '#86efac', fontWeight: 900 }}>
                                    ⏰ {time}{' '}
                                  </span>
                                  <span
                                    style={{
                                      color: 'rgba(230,244,255,0.88)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {name}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>

                    {normalizeUserName(r.user) === normalizeUserName(user || '') && (
                      <button
                        onClick={() => handleCancel(r.id)}
                        disabled={loading}
                        style={{
                          padding: 10,
                          background: 'rgba(239,68,68,0.16)',
                          border: '1px solid rgba(248,113,113,0.18)',
                          borderRadius: 12,
                          color: '#fca5a5',
                          cursor: 'pointer',
                          flexShrink: 0,
                          fontWeight: 800,
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Summary cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={dashboardCardStyle}>
              <div style={dashboardLabelStyle}>ยอดจองวันที่เลือก</div>
              <div style={dashboardValueStyle}>{todayCount}</div>
            </div>

            <div style={dashboardCardStyle}>
              <div style={dashboardLabelStyle}>Capacity</div>
              <div style={dashboardValueStyle}>
                {todayCount}/{MAX_PER_DAY}
              </div>
            </div>

            <div style={dashboardCardStyle}>
              <div style={dashboardLabelStyle}>Occupancy</div>
              <div style={dashboardValueStyle}>{occupancyPercent}%</div>
            </div>

            <div style={dashboardCardStyle}>
              <div style={dashboardLabelStyle}>Unique Users</div>
              <div style={dashboardValueStyle}>{uniqueUsers}</div>
            </div>
          </div>

          {/* 6. Admin Dashboard */}
          <div style={styles.card}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 12,
                alignItems: 'end',
              }}
            >
              <div>
                <h2 style={styles.sectionTitle}>🔐 Admin Dashboard</h2>
                <div style={styles.sectionSub}>
                  เปิดโหมดผู้ดูแลเพื่อดูสรุป, export CSV และวิเคราะห์ยอดจอง
                </div>
              </div>

              {!adminMode ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <input
                    style={styles.input}
                    placeholder="ใส่ Admin Key"
                    value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loginAdmin()}
                  />
                  <button onClick={loginAdmin} style={styles.btnAccent}>
                    เข้า Admin
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: '#86efac', fontWeight: 700 }}>
                    ✅ Admin Enabled
                  </span>
                  <button onClick={exportCSV} style={styles.btnPrimary}>
                    ⬇️ Export CSV
                  </button>
                  <button
                    onClick={() => setAdminMode(false)}
                    style={styles.btnGhost}
                  >
                    ปิด Admin
                  </button>
                </div>
              )}
            </div>
          </div>

          {adminMode && (
            <div style={styles.card}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                <div>
                  <h2 style={styles.sectionTitle}>📊 Top Time Slots</h2>
                  <div style={{ ...styles.sectionSub, marginBottom: 12 }}>
                    สรุป slot ที่ถูกเลือกมากที่สุดจากทุกข้อมูล
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {slotSummary.slice(0, 5).map((s, idx) => (
                      <div
                        key={s.slot}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.08)',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ textAlign: 'left', flex: 1 }}>
                          {idx + 1}. {s.slot}
                        </span>
                        <span style={{ color: '#86efac', fontWeight: 800 }}>
                          {s.count} คน
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 style={styles.sectionTitle}>🏆 Top Users</h2>
                  <div style={{ ...styles.sectionSub, marginBottom: 12 }}>
                    ผู้ใช้งานที่จองบ่อยที่สุด
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {topUsers.length === 0 ? (
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          color: '#9fb0c8',
                          border: '1px solid rgba(255,255,255,0.08)',
                          textAlign: 'left',
                        }}
                      >
                        ยังไม่มีข้อมูล
                      </div>
                    ) : (
                      topUsers.map((u, idx) => (
                        <div
                          key={u.name}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 14,
                            padding: '12px 14px',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <span style={{ textAlign: 'left', flex: 1 }}>
                            {idx + 1}. {u.name}
                          </span>
                          <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                            {u.count} ครั้ง
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', color: '#8ea3bd', fontSize: 12, marginTop: 10 }}>
          DOS x MOOV Fitness Booking • Premium UI • Mobile Responsive
        </div>
      </div>
    </div>
  );
}