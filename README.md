# Make Your Own Fish! 🐟

사용자가 직접 물고기를 그려서 **공유 바다**에 놓고, 다른 사람들이 그린 물고기와 함께 헤엄치는 경험을 할 수 있는 웹 앱입니다.

## 기능 요약

1. **시작 화면**  
   잔잔한 바다 배경과 "Make Your Own Fish!" 타이틀, **DRAW** 버튼.

2. **그리기 화면**  
   - 무지개 색 연필 7개 (빨강, 주황, 노랑, 초록, 파랑, 남색, 보라)  
   - 지우개  
   - 자유 캔버스 + **CREATE FISH** 버튼  

3. **물고기 생성**  
   - 그린 그림을 이미지로 변환  
   - Supabase Storage에 이미지 업로드  
   - DB에 기록 후 바다 화면으로 전환  

4. **공유 바다**  
   - 내 물고기 + 다른 사용자 물고기가 함께 수영  
   - 천천히 랜덤 방향으로 이동, 살짝 위아래로 떠다니는 애니메이션  
   - 새로 만든 물고기는 실시간(또는 새로고침)으로 반영  

5. **기타**  
   - 반응형 레이아웃  
   - 바다 배경 파라랙스  
   - 물고기 크기 랜덤(깊이 느낌)  

## 그리기 모드 / 전시 모드 (아이패드 + 모니터)

- **그리기 모드** (아이패드): `index.html` 또는 `index.html?mode=draw`  
  → 시작 화면 → DRAW → 그리기 → CREATE FISH → 바다. 다시 그리기 버튼으로 반복.

- **전시 모드** (모니터): `index.html?mode=exhibit`  
  → 바다와 물고기만 전체 화면으로 표시. 그리기/버튼 UI 없음.  
  → 아이패드에서 Supabase로 저장한 물고기가 실시간으로 모니터에 나타남.

같은 서버 주소로 두 기기 접속 시, 모니터에는 전시용 URL만 북마크해 두면 됩니다.

## 로컬 실행

- `index.html`을 브라우저에서 직접 열거나, 로컬 서버로 실행합니다.  
  예: `npx serve .` 또는 VS Code Live Server 사용  

- Supabase를 설정하지 않으면 **그리기 → CREATE FISH** 시 **내 물고기만** 바다에 표시됩니다.  
  다른 사람 물고기·전시 모드 연동을 하려면 아래처럼 Supabase를 설정해야 합니다.

## Supabase 설정 (공유 바다용)

1. [Supabase](https://supabase.com)에서 프로젝트 생성.

2. **Storage**  
   - 버킷 이름: `fish-images`  
   - Public 버킷으로 생성  
   - RLS 정책:  
     - 업로드: `INSERT` 허용 (예: `true` 또는 `auth.role() = 'anon'`)  
     - 읽기: `SELECT` 허용 (Public이면 읽기 허용 정책 추가)  

3. **Database**  
   - SQL Editor에서 아래 실행:

```sql
create table public.fish (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  created_at timestamptz default now()
);

-- 모든 사용자가 새 물고기 추가 가능
alter table public.fish enable row level security;
create policy "Allow insert" on public.fish for insert with check (true);
create policy "Allow select" on public.fish for select using (true);

-- Realtime 사용
alter publication supabase_realtime add table public.fish;
```

4. **프로젝트에 키 넣기**  
   - `app.js` 상단의 다음 값을 Supabase 대시보드에서 복사해 넣습니다.  
     - `SUPABASE_URL`: Project Settings → API → Project URL  
     - `SUPABASE_ANON_KEY`: Project Settings → API → anon public key  

설정 후에는 새로 그린 물고기가 DB와 Storage에 저장되고, 다른 사용자 화면에도 실시간으로 나타납니다.

## 파일 구성

- `index.html` — 시작 / 그리기 / 바다 세 화면 구조  
- `style.css` — 바다 배경, 웨이브, 그리기 UI, 물고기 스프라이트, 반응형  
- `app.js` — 화면 전환, 캔버스 그리기, Supabase 업로드·조회·Realtime, 물고기 애니메이션  

## 선택 사항 (추가하고 싶을 때)

- 배경에 잔잔한 환경음  
- 물고기 클릭 시 이름/날짜 툴팁  
- 파라랙스 강도 조절  

즐겁게 사용해 보세요. 🌊
