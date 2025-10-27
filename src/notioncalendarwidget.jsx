import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Notion API 기본 URL
const NOTION_API_URL = 'https://api.notion.com/v1/';

const App = () => {
    // ----------------- 상태 관리 -----------------
    const [token, setToken] = useState('');
    const [rawDbId, setRawDbId] = useState('');
    // 요청 방식: true=프록시 사용, false=직접 Notion 호출
    const [useProxy, setUseProxy] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);
    const [calendarData, setCalendarData] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    const today = useMemo(() => new Date(), []);
    const [displayDate, setDisplayDate] = useState(new Date());

    // DB ID 보정: 하이픈 없는 ID를 정식 UUID로 변환
    const dbId = useMemo(() => {
        if (!rawDbId || rawDbId.includes('-')) return rawDbId;
        if (rawDbId.length !== 32) return rawDbId;
        return `${rawDbId.substring(0, 8)}-${rawDbId.substring(8, 12)}-${rawDbId.substring(12, 16)}-${rawDbId.substring(16, 20)}-${rawDbId.substring(20)}`;
    }, [rawDbId]);
    
    // ConfigSubmit 핸들러
    const handleConfigSubmit = useCallback((e) => {
        e.preventDefault();
        // 프록시 사용 시에는 클라이언트 토큰 없이도 동작하도록 허용
        if (useProxy) {
            if (dbId.length > 20) {
                setIsConfigured(true);
                setApiError(null);
            } else {
                setApiError('DB ID 형식이 올바르지 않습니다.');
            }
            return;
        }

        // 직접 호출 모드에서는 token 필요
        // Notion 토큰은 `secret_` 또는 `ntn_` 등 다양한 접두사를 가질 수 있으므로
        // 너무 엄격하게 검사하지 않고 길이 기반/접두사 기반으로 허용합니다.
        const tokenOk = token && (token.startsWith('secret_') || token.startsWith('ntn_') || token.length > 10);
        if (tokenOk && dbId.length > 20) {
            setIsConfigured(true);
            setApiError(null);
        } else {
            setApiError('토큰 또는 DB ID 형식이 올바르지 않습니다.');
        }
    }, [token, dbId, useProxy]);


    // ----------------- Notion API 호출 함수 (오류 방지 로직 강화) -----------------
    const callNotionApi = useCallback(async (endpoint, method = 'GET', body = null) => {
        setApiError(null);
        // 프록시 사용 시에는 클라이언트 토큰이 필요하지 않음
        if (useProxy) {
            if (dbId.length < 32) {
                setApiError("DB ID가 누락되었거나 형식이 잘못되었습니다.");
                return null;
            }
        } else {
            if (!token || dbId.length < 32) {
                setApiError("토큰 또는 DB ID가 누락되었습니다.");
                return null;
            }
        }

        const PROXY_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_NOTION_PROXY)
            ? import.meta.env.VITE_NOTION_PROXY
            : 'http://localhost:8787/api/';

        // 요청 방식에 따라 URL과 헤더를 구성합니다.
        let url;
        const headers = {
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
            'X-Requested-With': 'XMLHttpRequest'
        };

        if (useProxy) {
            // 로컬/원격 프록시를 통해 요청 (프록시가 서버측 토큰을 붙이는 경우가 일반적)
            url = PROXY_URL + endpoint;
            // 프록시 연결 상태 확인 (헬스체크)
            try {
                const healthUrl = (PROXY_URL.endsWith('/') ? PROXY_URL : PROXY_URL + '/') + 'health';
                const h = await fetch(healthUrl, { method: 'GET' });
                if (!h.ok) {
                    setApiError(`프록시에 연결할 수 없습니다 (헬스체크 실패: ${h.status}). 프록시가 실행 중인지 확인하세요: ${PROXY_URL}`);
                    return null;
                }
            } catch (err) {
                setApiError(`프록시에 연결할 수 없습니다: ${err.message}. 서버가 실행 중인지, 그리고 CORS가 허용되어 있는지 확인하세요. 프록시 URL: ${PROXY_URL}`);
                return null;
            }
        } else {
            // 브라우저에서 직접 Notion API 호출 (사용자가 토큰을 입력한 경우)
            url = NOTION_API_URL + endpoint;
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Notion API Error:', response.status, errorData);
                
                let errorMessage = `API 호출 실패: ${response.status} (${errorData.code || '알 수 없음'})`;
                if (response.status === 401 || response.status === 403) {
                    errorMessage = "403/401 에러: 토큰이 잘못되었거나 DB에 권한이 없습니다. 확인해주세요.";
                }
                setApiError(errorMessage);
                return null;
            }
            return response.json();
        } catch (error) {
            console.error("Fetch Error:", error);
            // CORS/네트워크 실패의 경우 사용자에게 프록시 사용 제안
            if (!useProxy) {
                setApiError(`통신 오류(직접 호출 실패): ${error.message}. 브라우저 CORS 차단이 의심됩니다. '프록시 사용' 옵션을 켜고 서버 프록시를 실행해 보세요.`);
            } else {
                setApiError(`통신 오류: ${error.message}`);
            }
            return null;
        }
    }, [token, dbId, useProxy, setIsConfigured]); 

    // ----------------- 데이터 로드 로직 -----------------
    const loadCalendar = useCallback(async (date = displayDate) => {
        if (!isConfigured) return;
        setIsLoading(true);

        const year = date.getFullYear();
        const month = date.getMonth(); 

        const start = new Date(year, month, 1).toISOString().slice(0, 10);
        const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
        
        const payload = {
            filter: {
                and: [
                    { property: 'Date', date: { on_or_after: start } },
                    { property: 'Date', date: { on_or_before: end } }
                ]
            },
            page_size: 100
        };

        const data = await callNotionApi(`databases/${dbId}/query`, 'POST', payload); 
        
        if (data) {
            const items = data.results || [];
            const dayMap = {};
            items.forEach(p => {
                const dateProp = p.properties['Date']?.date?.start;
                const color = p.properties['Color']?.select?.name;
                
                if(dateProp){
                    const d = new Date(dateProp);
                    if (d.getFullYear() === year && d.getMonth() === month) {
                        const day = d.getDate(); 
                        dayMap[day] = { id: p.id, color: color || 'gray' };
                    }
                }
            });
            setCalendarData(dayMap);
        } else {
            setCalendarData({});
        }
        setIsLoading(false);
    }, [callNotionApi, dbId, isConfigured, displayDate]);

    // ----------------- 페이지 생성 로직 -----------------
    const addEntry = useCallback(async () => {
        if (!isConfigured) return;
        setIsLoading(true);

        const payload = {
            parent: { database_id: dbId },
            properties: {
                'Name': { title: [{ text: { content: `오늘의 기록 (${today.toLocaleDateString('ko-KR')})` } }] },
                'Date': { date: { start: today.toISOString() } },
                'Color': { select: { name: 'blue' } } 
            }
        };
        
        const data = await callNotionApi(`pages`, 'POST', payload); 
        
        if (data && data.id) {
            const pageId = data.id.replace(/-/g,'');
            window.open(`https://www.notion.so/${pageId}`, '_blank');
            setTimeout(() => loadCalendar(displayDate), 800); 
        }
        setIsLoading(false);
    }, [callNotionApi, dbId, isConfigured, today, displayDate, loadCalendar]);

    // ----------------- useEffect (초기 로드 및 달력 변경) -----------------
    useEffect(() => {
        if (isConfigured) {
            // 초기 로드 시 한 번만 실행되도록 수정
            loadCalendar();
        }
    }, [isConfigured, loadCalendar]); // displayDate 의존성 제거하여 불필요한 재호출 방지

    // ----------------- 렌더링 보조 함수 -----------------
    const renderMonthLabel = useMemo(() => {
        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        return `📅 °•.✦.••• ${monthNames[displayDate.getMonth()]}`;
    }, [displayDate]);

    const renderTodayLabel = useMemo(() => {
        const month = today.toLocaleString('en-US', { month: 'numeric' });
        const day = today.getDate();
        const weekday = today.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
        const finalDateString = `${month}/ ${day}/ ${weekday}`;
        return `♡ TODAY IS &nbsp;${finalDateString}`;
    }, [today]);

    const daysInMonth = useMemo(() => new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0).getDate(), [displayDate]);
    const firstDayIndex = useMemo(() => {
        const jsWeekday = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1).getDay();
        return (jsWeekday + 6) % 7; 
    }, [displayDate]);

    // ----------------- 캘린더 그리드 렌더링 -----------------
    const renderCalendarGrid = () => {
        const cells = [];
        const currentDay = today.getFullYear() === displayDate.getFullYear() && today.getMonth() === displayDate.getMonth() ? today.getDate() : -1;

        // 전달 빈 셀
        for(let i = 0; i < firstDayIndex; i++) {
            cells.push(<div key={`empty-${i}`} className="w-8 h-8 rounded-md cell empty"></div>);
        }

        // 현재 월 날짜
        for(let day = 1; day <= daysInMonth; day++) {
            const isToday = day === currentDay;
            const entry = calendarData[day];
            
            // 스타일링은 Tailwind CDN 클래스 사용에 맞춥니다.
            let classes = "w-8 h-8 rounded-md flex items-center justify-center text-sm font-medium transition-colors cursor-default bg-white border border-gray-100";
            let style = {};
            let color = entry ? entry.color : null;

            if (isToday) {
                // 오늘 날짜 스타일
                classes += " border-b-2 border-gray-500 rounded-none shadow-inner";
            }
            
            if (color) {
                // 기록이 있는 날짜 스타일 (Tailwind CDN은 동적 스타일을 지원하지 않으므로 inline style 사용)
                classes = "w-8 h-8 rounded-md flex items-center justify-center text-sm font-medium cursor-pointer";
                if (color === 'blue') style = { backgroundColor: '#cfe8ff' };
                else if (color === 'pink') style = { backgroundColor: '#ffd6e8' };
                else if (color === 'gray') style = { backgroundColor: '#dcdcdc' };
                else style = { backgroundColor: '#e0e0e0' };
            }
            
            const handleDayClick = () => {
                if (entry && entry.id) {
                    const pageId = entry.id.replace(/-/g,'');
                    window.open(`https://www.notion.so/${pageId}`, '_blank');
                }
            };
            
            cells.push(
                <div 
                    key={day} 
                    className={classes} 
                    style={style} 
                    onClick={handleDayClick}
                    title={color ? `기록 있음: ${color}` : `날짜 ${day}`}
                >
                    {day}
                </div>
            );
        }
        
        // 후행 빈 셀
        const totalCells = firstDayIndex + daysInMonth;
        const trailing = (42 - totalCells) % 7; 
        for(let i=0; i<trailing; i++){
            cells.push(<div key={`empty-trail-${i}`} className="w-8 h-8 rounded-md opacity-0 pointer-events-none"></div>);
        }

        return cells;
    };


    // ----------------- 미설정 상태 렌더링 -----------------
    if (!isConfigured) {
        return (
            <div className="p-6 max-w-sm mx-auto bg-gray-50 rounded-xl shadow-2xl space-y-4 border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 text-center">Notion Widget Setup</h2>
                <p className="text-xs text-gray-600 text-center">
                    Notion API 토큰과 데이터베이스 ID를 입력하세요.
                </p>
                <form onSubmit={handleConfigSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">요청 방식</label>
                        <div className="flex items-center space-x-4 text-xs">
                            <label className="flex items-center space-x-2">
                                <input type="radio" name="proxyMode" checked={!useProxy} onChange={() => setUseProxy(false)} />
                                <span>직접 Notion 호출 (브라우저에서 API 사용)</span>
                            </label>
                            <label className="flex items-center space-x-2">
                                <input type="radio" name="proxyMode" checked={useProxy} onChange={() => setUseProxy(true)} />
                                <span>프록시 사용 (CORS 회피, 권장)</span>
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">직접 호출은 브라우저 CORS 제약으로 실패할 수 있습니다. 실패 시 '프록시 사용'으로 전환하세요.</p>
                    </div>
                    <div>
                        <label htmlFor="token" className="text-xs font-semibold text-gray-700 block mb-1">Secret Token</label>
                        <input
                            id="token"
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required={!useProxy}
                        />
                    </div>
                    <div>
                        <label htmlFor="dbid" className="text-xs font-semibold text-gray-700 block mb-1">Database ID</label>
                        <input
                            id="dbid"
                            type="text"
                            value={rawDbId}
                            onChange={(e) => setRawDbId(e.target.value.trim().replace(/-/g, ''))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    {apiError && (
                        <p className="text-xs text-red-600 font-semibold bg-red-100 p-2 rounded-md border border-red-300">{apiError}</p>
                    )}
                    <button
                        type="submit"
                        className="w-full py-2 px-4 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        Notion과 연결하기
                    </button>
                </form>
            </div>
        );
    }

    // ----------------- 메인 위젯 렌더링 -----------------
    return (
        <div className="p-4 max-w-sm mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-4 space-y-3">
                
                {/* 월 표시 및 TODAY IS */}
                <div className="flex flex-col items-start space-y-1">
                    <div className="text-lg font-medium text-gray-700">{renderMonthLabel}</div>
                    <div className="text-sm font-semibold text-gray-600 border-b border-gray-200 pb-2 w-full">{renderTodayLabel}</div>
                </div>

                {/* 캘린더 그리드 */}
                <div className="space-y-1">
                    {/* 요일 */}
                    <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-500 text-center">
                        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                            <div key={day} className="w-8 h-6 flex items-center justify-center">{day}</div>
                        ))}
                    </div>

                    {/* 날짜 */}
                    <div className="grid grid-cols-7 gap-1">
                        {isLoading ? (
                            <div className="col-span-7 text-center py-4 text-gray-500">데이터 로딩 중...</div>
                        ) : (
                            renderCalendarGrid()
                        )}
                    </div>
                </div>

                {/* ADD ENTRY 버튼 */}
                <button
                    onClick={addEntry}
                    disabled={isLoading}
                    className="w-full mt-3 py-2 px-4 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2 border border-gray-300 shadow-sm"
                >
                    {isLoading ? (
                        '기록 요청 중...'
                    ) : (
                        <>
                            <span className="text-gray-400">—✦</span>
                            <span>ADD ENTRY</span>
                            <span className="text-gray-400">✦—</span>
                        </>
                    )}
                </button>
            </div>
            
            {/* API 에러 발생 시 재설정 버튼 제공 */}
            {apiError && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-center">
                    <p className="text-sm text-red-700">{apiError}</p>
                    <button onClick={() => setIsConfigured(false)} className="mt-2 text-xs font-semibold text-red-700 underline">
                        토큰/DB ID 재설정
                    </button>
                </div> 
            )}
        </div>
    );
};

export default App;
