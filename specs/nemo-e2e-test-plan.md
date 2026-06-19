# Nemo FE E2E 테스트 계획

## Application Overview

Nemo는 공유 포토앨범 협업 에디터 웹앱이다. React + Vite + Excalidraw 기반 프론트엔드(포트 5173)와 Spring Boot 백엔드(포트 8080)로 구성된다. 사용자는 앨범을 생성·편집·공유하고, Excalidraw 캔버스에서 도형·텍스트·자유 드로잉·이미지를 그릴 수 있으며, WebSocket으로 실시간 동기화된다. 보호 라우트(/albums, /albums/:id, /trash)는 JWT accessToken이 없으면 /login으로 리다이렉트된다.

주요 엔티티: 앨범(Album), 페이지(Page), 캔버스 요소(ExcalidrawElement), 멤버(Member), 초대 링크(InviteLink), 휴지통(Trash).

테스트 픽스처:
- tests/.auth/alice.json — Alice(alice@e2e.test) storage state
- tests/.auth/bob.json — Bob(bob@e2e.test) storage state
- tests/asset/ — 이미지 업로드용 JPEG 파일 2장
- tests/helpers/api.ts — API 직접 호출 헬퍼 (testLogin, createAlbum, getInviteCode, joinByCode)
- tests/helpers/canvas.ts — Excalidraw 캔버스 조작 헬퍼 (waitCanvas, drawRect, selectAllAndDelete, getSceneElementCount, expectCountConverges)
- tests/helpers/users.ts — ALICE/BOB/CAROL 상수 + AUTH 경로
- tests/helpers/multiUser.ts — 멀티유저 fixture (alice, bob, collabAlbum, aliceToken, bobToken)
- tests/helpers/scenarios.ts — UI 시나리오 헬퍼 (createAlbumViaUI, addPage, deleteCurrentPage, deleteAlbumViaSettings 등)

사전 조건: 백엔드 서버가 localhost:8080에서 실행 중이어야 하며, /auth/test-login 엔드포인트가 활성화되어 있어야 한다. setup 프로젝트(auth.setup.ts)가 먼저 실행되어 tests/.auth/*.json 을 생성해야 한다.

## Test Scenarios

### 1. A. 단일 사용자 시나리오

**Seed:** `tests/auth.setup.ts`

#### 1.1. A-01: Auth 가드 — 미로그인 상태에서 보호된 라우트 접근 시 /login 리다이렉트

**File:** `tests/single-user/01_auth_guard.spec.ts`

**Steps:**
  1. 스토리지가 비어 있는 새 컨텍스트를 사용한다(storageState 미적용). page.goto('/albums')를 호출한다.
    - expect: URL이 http://localhost:5173/login 으로 리다이렉트되어야 한다.
  2. page.goto('/albums/some-uuid')를 호출한다.
    - expect: URL이 /login 으로 리다이렉트되어야 한다.
  3. page.goto('/trash')를 호출한다.
    - expect: URL이 /login 으로 리다이렉트되어야 한다.
  4. 로그인 페이지 UI를 검증한다. page.getByRole('heading') 또는 text로 'nemo' 로고, '함께 찍고, 함께 꾸미고, 함께 간직하세요' 태그라인, '소셜 로그인'/'이메일 로그인' 탭 버튼, '카카오로 시작하기' 링크, 이용약관 안내 문구를 확인한다.
    - expect: nemo 로고 텍스트가 보여야 한다.
    - expect: 태그라인 '함께 찍고, 함께 꾸미고, 함께 간직하세요'가 표시되어야 한다.
    - expect: 소셜 로그인 탭이 기본 선택 상태여야 한다.
    - expect: 카카오로 시작하기 버튼(링크)이 노출되어야 한다.
  5. 이메일 로그인 탭을 클릭한다.
    - expect: 이메일 input, 비밀번호 input, 로그인 버튼이 나타나야 한다.
    - expect: 로그인/회원가입 토글 버튼이 노출되어야 한다.
  6. 회원가입 버튼을 클릭한다.
    - expect: 닉네임 입력 필드가 추가로 나타나야 한다.
  7. 이메일 필드에 형식이 올바르지 않은 값(예: 'notanemail')을 입력하고 가입하기 버튼을 클릭한다.
    - expect: HTML5 유효성 검사 또는 에러 메시지가 노출되어야 한다.

#### 1.2. A-02: 이메일 로그인 성공 및 헤더 닉네임/이메일/아바타 렌더링 확인

**File:** `tests/single-user/02_login.spec.ts`

**Steps:**
  1. storageState: ALICE_AUTH 로 컨텍스트를 생성한다. page.goto('/albums')를 호출한다.
    - expect: URL이 /albums 를 유지해야 한다 (리다이렉트 없음).
    - expect: 헤더에 nemo 로고 그라디언트 텍스트가 보여야 한다.
    - expect: 헤더 우측에 Alice 닉네임 배지(아바타 원형 + 닉네임 텍스트)가 노출되어야 한다.
    - expect: 아바타는 profileImage가 없을 경우 닉네임 첫 글자('A')를 hsl 색상 배경에 흰색 텍스트로 표시해야 한다.
    - expect: 알림 벨 버튼이 노출되어야 한다.
    - expect: 다크 모드 토글(Moon 아이콘) 버튼이 노출되어야 한다.
    - expect: 휴지통 버튼과 '+ 새 앨범' 버튼, 로그아웃 버튼이 보여야 한다.
  2. 헤더의 닉네임 배지에 마우스를 올려 title 속성(이메일)을 확인한다. page.locator('[title*="alice@e2e.test"]')로 검증한다.
    - expect: title 속성에 alice@e2e.test 가 포함되어야 한다.
  3. 다크 모드 버튼을 클릭한다.
    - expect: 버튼 아이콘이 Moon에서 Sun으로 바뀌어야 한다. 페이지 배경색이 어두워져야 한다.
  4. 다크 모드 버튼을 다시 클릭하여 라이트 모드로 복귀한다.
    - expect: Moon 아이콘이 다시 나타나야 한다. 배경색이 원래대로 복귀해야 한다.
  5. 로그아웃 버튼을 클릭한다.
    - expect: URL이 /login 으로 이동해야 한다. localStorage의 accessToken 키가 삭제되어야 한다.
  6. 로그아웃 후 page.goto('/albums')를 호출한다.
    - expect: /login 으로 리다이렉트되어야 한다.

#### 1.3. A-03: 앨범 리스트 조회 — 빈 상태 및 카드 레이아웃 UI 렌더링

**File:** `tests/single-user/03_album_list.spec.ts`

**Steps:**
  1. ALICE_AUTH storage state로 /albums 접근. 앨범이 하나도 없는 초기 상태를 가정한다(또는 API로 기존 앨범을 미리 정리).
    - expect: 빈 상태 UI: 큰 Camera 아이콘(60px)이 노출되어야 한다.
    - expect: '아직 앨범이 없어요' 제목 텍스트가 보여야 한다.
    - expect: '새 앨범을 만들어 소중한 순간을 함께 담아보세요' 설명 문구가 보여야 한다.
    - expect: '첫 앨범 만들기' 버튼이 노출되어야 한다.
  2. 헤더 '+ 새 앨범' 버튼을 클릭한다.
    - expect: 모달 오버레이(backdrop-filter blur)가 나타나야 한다.
    - expect: '새 앨범 만들기' 제목이 보여야 한다.
    - expect: '앨범 이름을 입력하세요 (최대 30자)' 안내 문구가 보여야 한다.
    - expect: placeholder '앨범 이름'인 input이 autofocus 되어야 한다.
    - expect: 0/30 글자 수 카운터가 노출되어야 한다.
    - expect: 취소/만들기 버튼이 보여야 한다.
    - expect: 만들기 버튼은 비어 있을 때 disabled 상태여야 한다.
  3. input에 30자를 초과하는 텍스트를 붙여넣기 시도한다.
    - expect: maxLength=30 제한으로 30자까지만 입력되어야 한다. 글자 수 카운터가 30/30으로 표시되어야 한다.
  4. 취소 버튼을 클릭한다.
    - expect: 모달이 닫혀야 한다.
  5. 다시 모달을 열고 앨범 이름 'TestAlbum-A03'을 입력 후 만들기 버튼을 클릭한다.
    - expect: 모달이 닫히고 에디터 URL(/albums/:id)로 이동해야 한다.
    - expect: 에디터 헤더에 'TestAlbum-A03' 앨범 이름이 표시되어야 한다.
  6. 뒤로가기(← 목록 버튼)를 클릭하여 /albums로 돌아온다.
    - expect: '내가 만든 앨범' 섹션이 노출되어야 한다.
    - expect: 카드에 앨범 커버(그라디언트 배경), '내 앨범' 배지(우상단), 앨범 이름, '멤버 1명' 텍스트, 방금 전/시간 표시가 보여야 한다.
    - expect: 앨범 카드 수 배지(분홍색 배경의 숫자)가 섹션 헤더 옆에 보여야 한다.
  7. 앨범 카드에 마우스를 올린다(hover).
    - expect: 카드가 translateY(-4px) 위로 이동하고 박스 섀도우가 강조되어야 한다.

#### 1.4. A-04: 에디터 진입 및 UI 렌더링 — 헤더, 페이지 탭, 캔버스, 상태 표시

**File:** `tests/single-user/04_editor_ui.spec.ts`

**Steps:**
  1. scenarios.ts의 createAlbumViaUI 헬퍼로 앨범을 생성하여 에디터에 진입한다.
    - expect: URL이 /albums/:id 형태여야 한다.
  2. 에디터 헤더 요소를 검증한다.
    - expect: '← 목록' 뒤로가기 버튼이 있어야 한다.
    - expect: 구분선(1px) 후 앨범 이름 텍스트가 있어야 한다.
    - expect: '나' 배지(회색 배경 흰색 텍스트)가 있어야 한다.
    - expect: '실시간 동기화' 상태 필(녹색) 또는 '연결 중' 필(보라)이 있어야 한다.
    - expect: 다크 모드 토글 버튼, 멤버 관리(Users 아이콘) 버튼, 앨범 설정(Settings 아이콘) 버튼이 있어야 한다.
  3. 페이지 탭 영역을 검증한다.
    - expect: '페이지 1' 탭이 활성(bold, 배경 흰색) 상태로 있어야 한다.
    - expect: '+ 페이지' 추가 버튼(점선 테두리)이 있어야 한다.
    - expect: 페이지가 1개일 때 X 삭제 버튼이 보이지 않아야 한다.
  4. Excalidraw 캔버스 영역을 검증한다. waitCanvas 헬퍼로 캔버스 로드를 대기한다.
    - expect: canvas 요소가 DOM에 있어야 한다.
    - expect: Excalidraw 툴바(도형, 텍스트, 자유그리기, 이미지 등 툴)가 보여야 한다.
    - expect: 캔버스 배경이 렌더링되어야 한다.
  5. 앨범 설정 버튼(Settings 아이콘)을 클릭한다.
    - expect: '앨범 설정' 모달이 열려야 한다.
    - expect: 앨범 이름 input 필드가 현재 이름으로 채워져 있어야 한다.
    - expect: 저장 버튼이 있어야 한다.
    - expect: '앨범 잠금' 토글 스위치가 있어야 한다.
    - expect: 잠금 설명 문구 '잠금 시 편집이 제한되고 모든 편집자 세션이 종료됩니다'가 있어야 한다.
    - expect: '앨범 삭제 (휴지통으로 이동)' 버튼(빨간 테두리)이 있어야 한다.
    - expect: 닫기 버튼이 있어야 한다.
  6. Escape 키를 눌러 설정 모달을 닫는다.
    - expect: 모달이 닫혀야 한다.
  7. 멤버 관리 버튼(Users 아이콘)을 클릭한다.
    - expect: '멤버 관리' 모달이 열려야 한다.
    - expect: '멤버' / '초대 링크' 탭이 있어야 한다.
    - expect: '멤버 (1)' 라벨 아래 Alice가 '관리자'로 표시되어야 한다.
  8. '초대 링크' 탭을 클릭한다.
    - expect: 활성 초대 링크 URL(http://localhost:5173/invite/CODE 형태)이 표시되거나, 없으면 '활성화된 초대 링크가 없습니다' 문구가 보여야 한다.
    - expect: '새 링크 발급' 버튼(점선 테두리)이 있어야 한다.
  9. X 버튼 또는 오버레이 클릭으로 멤버 모달을 닫는다.
    - expect: 모달이 닫혀야 한다.

#### 1.5. A-05: 에디터 편집 — 사각형/원/텍스트/자유 드로잉 추가 및 저장 확인

**File:** `tests/single-user/05_editor_draw.spec.ts`

**Steps:**
  1. createAlbumViaUI로 앨범 생성 후 에디터 진입. waitCanvas로 로드 대기.
    - expect: 캔버스가 렌더링되어야 한다.
  2. drawRect 헬퍼 호출: tool='r', offsetX=-100, offsetY=-40. 사각형을 그린다.
    - expect: getSceneElementCount(page)가 1을 반환해야 한다.
  3. drawRect 헬퍼 호출: tool='o', offsetX=50, offsetY=-40. 원(타원)을 그린다.
    - expect: getSceneElementCount(page)가 2를 반환해야 한다.
  4. drawTextAt 헬퍼 호출: offsetX=0, offsetY=60, text='Hello Nemo'. 텍스트를 추가한다.
    - expect: getSceneElementCount(page)가 3을 반환해야 한다.
  5. drawFreeStroke 헬퍼 호출: offsetX=100, offsetY=60. 자유 드로잉을 추가한다.
    - expect: getSceneElementCount(page)가 4를 반환해야 한다.
  6. page.reload()로 페이지를 새로고침한다. waitCanvas로 로드 대기 후 2000ms 추가 대기.
    - expect: getSceneElementCount(page)가 4를 반환해야 한다 (서버 저장 후 복원).
    - expect: 또는 excalidrawAPI.getSceneElements() 미노출 환경에서는 canvas 요소가 정상 렌더링되어야 한다.
  7. 이미지 업로드: Excalidraw 툴바에서 이미지 삽입 도구를 선택(또는 i 단축키). 파일 선택 다이얼로그가 열리면 tests/asset/KakaoTalk_Photo_2026-06-15-14-32-13 001.jpeg 파일을 업로드한다.
    - expect: 캔버스에 이미지 요소가 삽입되어야 한다.
    - expect: getSceneElementCount(page)가 5 이상이어야 한다.
    - expect: 네트워크 요청 중 POST /albums/:id/images 요청이 발생하고 200 응답이 와야 한다.
  8. selectAllAndDelete 헬퍼를 호출한다(Ctrl+A → Delete).
    - expect: getSceneElementCount(page)가 0이어야 한다.

#### 1.6. A-06: 새 페이지 생성 및 페이지별 편집 내용 분리 확인

**File:** `tests/single-user/06_page_add.spec.ts`

**Steps:**
  1. createAlbumViaUI로 앨범 생성. 페이지 1에 fillPageWithThreeElements 헬퍼로 3개 요소를 추가한다.
    - expect: 페이지 1의 getSceneElementCount가 3이어야 한다.
  2. addPage 헬퍼 호출(+ 페이지 버튼 클릭). waitCanvas 대기.
    - expect: '페이지 2' 탭이 추가되고 활성 상태여야 한다.
    - expect: 페이지 1 탭도 탭 목록에 있어야 한다.
    - expect: 두 개 이상의 페이지가 있으므로 활성 탭에 X 버튼이 표시되어야 한다.
    - expect: 새 페이지 캔버스가 비어 있어야 한다(getSceneElementCount = 0).
  3. 페이지 2에 drawRect(offsetX=0, offsetY=0, tool='d')로 다이아몬드를 추가하고, drawTextAt(0, 80, 'Page2Text')로 텍스트를 추가한다.
    - expect: getSceneElementCount(page)가 2여야 한다.
  4. 페이지 1 탭을 클릭하여 전환한다.
    - expect: 페이지 1의 요소 수가 3이어야 한다 (페이지 2 요소와 분리).
    - expect: 페이지 1 탭이 활성 상태여야 한다.
  5. page.reload() 후 waitCanvas 대기. 페이지 탭 목록 확인.
    - expect: 페이지 1, 페이지 2 탭이 모두 존재해야 한다.
    - expect: 현재 활성 페이지의 요소가 유지되어야 한다.

#### 1.7. A-07: 페이지 삭제 및 휴지통/복원 — 페이지 복원 후 편집 가능 확인

**File:** `tests/single-user/07_page_trash.spec.ts`

**Steps:**
  1. 앨범을 생성하고 addPage 헬퍼로 페이지 2를 추가한다. 페이지 1에 요소 3개(fillPageWithThreeElements), 페이지 2에 drawRect 1개를 추가한다.
    - expect: 두 페이지 모두 요소가 있어야 한다.
  2. 페이지 2 탭을 활성화한다. deleteCurrentPage 헬퍼를 호출한다. window.confirm 다이얼로그를 수락(acceptAllDialogs 적용)한다.
    - expect: 페이지 2 탭이 사라져야 한다.
    - expect: 페이지 1 탭이 자동으로 활성화되어야 한다.
    - expect: 페이지 1의 요소가 그대로여야 한다.
  3. gotoTrash 헬퍼로 /trash 로 이동한다.
    - expect: 헤더에 '휴지통' 제목이 있어야 한다.
    - expect: '삭제 후 30일 이내 복원 가능' 안내 문구가 있어야 한다.
    - expect: 휴지통 카드가 하나 이상 있어야 한다.
    - expect: 카드에 '📄 페이지' 아이콘과 '○일 후 영구 삭제' 텍스트가 있어야 한다.
    - expect: 복원 버튼과 영구 삭제 버튼이 있어야 한다.
  4. restoreFirstInTrash 헬퍼를 호출한다. window.confirm 수락 후 대기한다.
    - expect: 휴지통에서 해당 항목이 사라져야 한다.
  5. ← 앨범 목록 버튼 클릭 후 해당 앨범 에디터로 재진입한다.
    - expect: 복원된 페이지 탭이 다시 나타나야 한다.
    - expect: 복원된 페이지의 요소가 유지되어야 한다.
  6. 복원된 페이지에서 drawRect를 추가로 그린다.
    - expect: 새 요소가 추가되어야 한다(기존 요소 + 1).

#### 1.8. A-08: 앨범 삭제 및 복원 — 복원 후 에디터 진입 및 편집 가능 확인

**File:** `tests/single-user/08_album_trash.spec.ts`

**Steps:**
  1. createAlbumViaUI로 앨범을 생성하고 albumId를 URL에서 추출한다. 페이지 1에 fillPageWithThreeElements로 요소를 추가한다.
    - expect: 에디터에 3개 요소가 있어야 한다.
  2. openAlbumSettings 헬퍼로 앨범 설정 모달 열기. '앨범 삭제 (휴지통으로 이동)' 버튼 클릭. window.confirm 수락.
    - expect: URL이 /albums 로 이동해야 한다.
    - expect: 앨범 목록에서 해당 앨범 카드가 사라져야 한다.
  3. gotoTrash로 /trash 로 이동.
    - expect: 삭제된 앨범이 '📷 앨범' 타입 카드로 목록에 있어야 한다.
    - expect: 카드에 남은 일수(N일 후 영구 삭제)가 표시되어야 한다.
  4. restoreFirstInTrash 헬퍼로 복원. confirm 수락.
    - expect: 휴지통 항목에서 앨범 카드가 사라져야 한다.
  5. /albums 로 이동. 복원된 앨범 카드를 찾아 클릭한다.
    - expect: 앨범 카드가 '내가 만든 앨범' 섹션에 다시 나타나야 한다.
    - expect: 에디터(/albums/:id)로 진입할 수 있어야 한다.
    - expect: 복원된 앨범의 캔버스 요소(3개)가 그대로 있어야 한다.
  6. 복원된 앨범 에디터에서 drawRect를 추가한다.
    - expect: 새 요소가 추가되어야 한다.

#### 1.9. A-09: 앨범 재삭제 및 휴지통 영구 삭제

**File:** `tests/single-user/09_album_perm_delete.spec.ts`

**Steps:**
  1. createAlbumViaUI로 앨범을 생성하고 에디터에 진입한다.
    - expect: 에디터가 정상 로드되어야 한다.
  2. deleteAlbumViaSettings 헬퍼로 앨범을 삭제한다. window.confirm 수락.
    - expect: /albums 로 이동해야 한다.
  3. gotoTrash로 /trash 로 이동.
    - expect: 앨범 카드가 휴지통에 있어야 한다.
  4. permanentDeleteFirstInTrash 헬퍼를 호출한다. window.confirm 수락.
    - expect: 해당 앨범 카드가 목록에서 사라져야 한다.
    - expect: 휴지통이 비어 있을 경우 expectTrashEmpty 헬퍼로 '휴지통이 비어 있습니다' 텍스트와 Trash2 아이콘(48px)이 보여야 한다.
  5. /albums/:이전albumId 로 직접 접근을 시도한다.
    - expect: 404 또는 에러 메시지가 표시되거나 /albums 로 리다이렉트되어야 한다.

#### 1.10. A-10: 데이터 동기화 — 새로고침 후 캔버스 데이터 유지 확인

**File:** `tests/single-user/10_sync_refresh.spec.ts`

**Steps:**
  1. createAlbumViaUI로 앨범 생성 후 에디터 진입. fillPageWithThreeElements로 요소 3개 추가. 500ms 대기.
    - expect: getSceneElementCount가 3이어야 한다.
  2. page.reload() 실행. waitCanvas 대기 + 2000ms 추가 대기.
    - expect: getSceneElementCount가 3이어야 한다.
    - expect: 페이지 탭이 정상 복원되어야 한다.
  3. 새 탭(page.context().newPage())을 열어 동일 앨범 URL로 이동한다.
    - expect: 새 탭의 getSceneElementCount도 3이어야 한다.
    - expect: 두 탭 간 데이터가 일치해야 한다.
  4. 새 탭에서 추가로 drawRect를 그린다. 원래 탭으로 돌아가서 1500ms 대기 후 element count를 확인한다.
    - expect: 원래 탭에서도 element count가 4로 증가해야 한다(WS 실시간 동기화).
    - expect: 두 탭 간 WebSocket 연결이 각각 '실시간 동기화' 상태 필로 표시되어야 한다.

### 2. B. 멀티 사용자 시나리오 (Alice + Bob)

**Seed:** `tests/auth.setup.ts`

#### 2.1. B-01: 두 사용자 동시 세션 — 앨범 생성 및 2개 페이지에 요소 추가

**File:** `tests/multi-user/01_collab_setup.spec.ts`

**Steps:**
  1. multiUser.ts의 test fixture를 사용한다: alice, bob 두 컨텍스트를 각각 ALICE_AUTH, BOB_AUTH storage state로 연다. alice.page로 createAlbumViaUI('ColabAlbum-B01')을 호출하여 앨범을 생성하고 albumId를 확보한다.
    - expect: Alice의 에디터가 /albums/:id 로 진입해야 한다.
  2. Alice: 페이지 1에 fillPageWithThreeElements(baseOffsetX=0) 호출. 3개 요소 추가.
    - expect: Alice 쪽 getSceneElementCount = 3.
  3. Alice: addPage 헬퍼로 페이지 2 추가. fillPageWithThreeElements(baseOffsetX=50) 호출.
    - expect: Alice 쪽 페이지 2에 3개 요소. 페이지 탭에 '페이지 1', '페이지 2' 모두 존재.
  4. Alice: getInviteCode API 또는 getInviteCodeFromUI 헬퍼로 초대 코드를 확보한다. inviteCode를 저장한다.
    - expect: 초대 코드 문자열이 반환되어야 한다.
  5. Bob: bob.page.goto('/invite/' + inviteCode)로 초대 페이지에 진입한다.
    - expect: 초대 페이지에 'Alice님이 초대했어요' 문구가 보여야 한다.
    - expect: 앨범 이름 'ColabAlbum-B01'이 표시되어야 한다.
    - expect: '앨범 참여하기' 버튼이 있어야 한다(Bob은 이미 로그인 상태이므로).
  6. Bob: '앨범 참여하기' 버튼을 클릭한다.
    - expect: URL이 /albums 로 이동해야 한다.
    - expect: 또는 승인이 필요 없는 초대 링크라면 바로 앨범 목록으로 이동해야 한다.
  7. Bob: /albums/:albumId 로 직접 이동한다. gotoEditor(bob.page, albumId).
    - expect: Bob의 에디터가 열려야 한다.
    - expect: 에디터 헤더에 'ColabAlbum-B01' 앨범 이름이 보여야 한다.
    - expect: 페이지 1, 페이지 2 탭이 모두 보여야 한다.

#### 2.2. B-02: 멀티 사용자 — 이전 편집물이 양쪽 모두에서 모든 페이지에 표시되는지 검증

**File:** `tests/multi-user/02_collab_content_visible.spec.ts`

**Steps:**
  1. collabAlbum fixture와 aliceToken, bobToken fixture를 사용한다. Alice가 페이지 1, 페이지 2에 각각 fillPageWithThreeElements로 요소를 추가한다. 각 페이지 변경 후 800ms 대기.
    - expect: Alice 페이지 1: element count=3, 페이지 2: element count=3.
  2. Bob: gotoEditor(bob.page, albumId)로 에디터 진입. waitCanvas 대기 + 1500ms 추가.
    - expect: Bob 화면 페이지 1에서 getSceneElementCount = 3이어야 한다.
    - expect: '실시간 동기화' 또는 '연결 중' 상태 필이 있어야 한다.
  3. Bob: 페이지 2 탭을 클릭한다. waitCanvas 대기 + 1000ms.
    - expect: Bob 화면 페이지 2에서 getSceneElementCount = 3이어야 한다.
  4. Alice: 페이지 1 탭을 클릭하여 전환. Bob: 페이지 1로 전환. 양쪽 모두 element count 비교.
    - expect: expectCountConverges([alice.page, bob.page], 3, 5000)이 통과해야 한다.

#### 2.3. B-03: 멀티 사용자 — 에디터 객체 편집/생성/삭제 실시간 동기화 (페이지 1, 2)

**File:** `tests/multi-user/03_collab_sync_draw.spec.ts`

**Steps:**
  1. collabAlbum fixture 사용. Alice, Bob 모두 페이지 1 에디터에 진입. waitCanvas 대기.
    - expect: 두 사용자 모두 에디터가 열려야 한다.
  2. Alice: drawRect(offsetX=-100, offsetY=0, tool='r') 추가. 500ms 대기.
    - expect: Alice 화면 element count = 1.
  3. Bob: 1500ms 대기 후 element count 확인.
    - expect: expectCountConverges([alice.page, bob.page], 1, 5000) 통과. Bob 화면에도 사각형이 나타나야 한다.
  4. Bob: drawTextAt(50, 50, 'BobText') 추가. 500ms 대기.
    - expect: Bob 화면 element count = 2.
  5. Alice: 1500ms 대기 후 element count 확인.
    - expect: expectCountConverges([alice.page, bob.page], 2, 5000) 통과.
  6. Alice: 이미지 삽입 도구로 tests/asset/KakaoTalk_Photo_2026-06-15-14-32-14 002.jpeg 업로드. 1000ms 대기.
    - expect: Alice 화면에 이미지 요소가 추가되어야 한다.
    - expect: POST /albums/:id/images 요청이 성공해야 한다.
  7. Bob: 2000ms 대기 후 element count 확인. 이미지 요소가 Bob 화면에도 보이는지 확인.
    - expect: expectCountConverges([alice.page, bob.page], 3, 8000) 통과. Bob 화면에 이미지가 렌더링되어야 한다.
  8. Alice: Ctrl+A → Delete로 전체 삭제. 500ms 대기.
    - expect: Alice element count = 0.
  9. Bob: 2000ms 대기 후 element count 확인.
    - expect: expectCountConverges([alice.page, bob.page], 0, 5000) 통과. Bob 화면도 비어야 한다.
  10. 페이지 2 탭으로 전환하여 동일 순서(생성→동기화→삭제→동기화)를 반복한다.
    - expect: 페이지 2에서도 모든 동기화 검증이 통과해야 한다.

#### 2.4. B-04: 멀티 사용자 — 새 페이지 생성 및 해당 페이지 객체 동기화

**File:** `tests/multi-user/04_collab_new_page.spec.ts`

**Steps:**
  1. collabAlbum fixture 사용. Alice, Bob 모두 에디터 진입(페이지 1). waitCanvas 대기.
    - expect: 두 사용자 에디터가 각자 열려야 한다.
  2. Alice: addPage 헬퍼로 페이지 3 추가(앨범에 이미 기본 2페이지가 있다고 가정). waitCanvas 대기.
    - expect: Alice 탭 목록에 '페이지 3' 탭이 생겨야 한다.
    - expect: Alice 페이지 3 canvas가 비어야 한다.
  3. Bob: 1500ms 대기 후 탭 목록 확인.
    - expect: Bob 탭 목록에도 새 페이지 탭이 나타나야 한다 (WS pageEvent 'added' 수신).
  4. Alice: 페이지 3에 fillPageWithThreeElements 호출. 500ms 대기.
    - expect: Alice element count = 3.
  5. Bob: 페이지 3 탭 클릭. waitCanvas + 1500ms 대기 후 element count 확인.
    - expect: expectCountConverges([alice.page, bob.page], 3, 5000) 통과.
  6. Bob: 페이지 3에 drawRect(offsetX=150, offsetY=0) 추가. 500ms 대기.
    - expect: Bob element count = 4.
  7. Alice: 1500ms 대기. element count 확인.
    - expect: expectCountConverges([alice.page, bob.page], 4, 5000) 통과.

#### 2.5. B-05: 멀티 사용자 — 페이지 삭제/복원 동기화 및 복원 후 편집 가능

**File:** `tests/multi-user/05_collab_page_trash.spec.ts`

**Steps:**
  1. collabAlbum fixture 사용. Alice가 페이지 1에 요소 추가. addPage로 페이지 2 추가 후 요소 추가. Bob도 동일 앨범 에디터 진입.
    - expect: 두 사용자 모두 페이지 1, 2 탭을 볼 수 있어야 한다.
  2. Alice: 페이지 2 탭 활성화. deleteCurrentPage 헬퍼로 페이지 2 삭제. confirm 수락. 500ms 대기.
    - expect: Alice 탭 목록에서 페이지 2가 사라지고 페이지 1로 이동해야 한다.
  3. Bob: 1500ms 대기 후 탭 목록 확인.
    - expect: Bob 화면에서도 페이지 2 탭이 사라져야 한다 (WS pageEvent 'deleted' 수신).
  4. Alice: gotoTrash로 /trash 이동. 페이지 항목 확인 후 restoreFirstInTrash로 복원. confirm 수락.
    - expect: 휴지통에서 페이지 카드가 사라져야 한다.
  5. Alice: 에디터로 복귀(/albums/:albumId). waitCanvas 대기.
    - expect: 복원된 페이지 탭이 다시 나타나야 한다.
    - expect: 복원된 페이지의 기존 요소가 유지되어야 한다.
  6. Bob: 에디터 새로고침(page.reload()). waitCanvas 대기.
    - expect: Bob 화면에서도 복원된 페이지 탭이 나타나야 한다.
  7. Alice: 복원된 페이지에 drawRect를 추가한다. 500ms 대기.
    - expect: Alice element count가 기존+1이어야 한다.
  8. Bob: 해당 페이지 탭 클릭. 1500ms 대기. element count 확인.
    - expect: Bob element count도 동일하게 증가해야 한다.

#### 2.6. B-06: 멀티 사용자 — 앨범 삭제/복원 동기화 및 복원 후 편집 가능

**File:** `tests/multi-user/06_collab_album_trash.spec.ts`

**Steps:**
  1. collabAlbum fixture 사용. Alice, Bob 모두 에디터 진입. 각 페이지에 요소 추가.
    - expect: 두 사용자 모두 에디터가 열려야 한다.
  2. Alice: deleteAlbumViaSettings 헬퍼로 앨범을 휴지통으로 이동. confirm 수락.
    - expect: Alice가 /albums 로 리다이렉트되어야 한다.
    - expect: 앨범 목록에서 해당 앨범 카드가 사라져야 한다.
  3. Bob: 앨범 삭제로 인해 에디터에서 강제 종료 메시지가 표시되거나, 페이지 재방문 시 에러가 발생하는지 확인한다. 또는 forceCloseMessage UI('앨범 목록으로' 버튼)가 표시되는지 확인한다.
    - expect: Bob 에디터에서 앨범 접근 불가 상태가 표시되거나 /albums 로 리다이렉트되어야 한다.
  4. Alice: gotoTrash로 /trash 이동. restoreFirstInTrash로 앨범 복원. confirm 수락.
    - expect: 휴지통에서 앨범 카드가 사라져야 한다.
  5. Alice: /albums 이동 후 복원된 앨범 카드 클릭하여 에디터 재진입. waitCanvas 대기.
    - expect: 에디터가 정상 로드되어야 한다.
    - expect: 복원된 앨범의 페이지와 요소가 그대로여야 한다.
  6. Bob: /albums/:albumId 로 재진입 시도. waitCanvas 대기.
    - expect: Bob도 에디터에 진입할 수 있어야 한다.
    - expect: 복원된 앨범 데이터가 보여야 한다.
  7. Alice: drawRect 추가. Bob: 1500ms 대기 후 element count 확인.
    - expect: expectCountConverges 통과. 복원 후에도 실시간 동기화가 동작해야 한다.

#### 2.7. B-07: 두 사용자 로그아웃

**File:** `tests/multi-user/07_collab_logout.spec.ts`

**Steps:**
  1. Alice: logoutFromList 헬퍼 호출(/albums 이동 → 로그아웃 버튼 클릭).
    - expect: URL이 /login 으로 이동해야 한다.
    - expect: 로그인 페이지가 정상 렌더링되어야 한다.
  2. Bob: alice.page 기준 bob.page도 로그아웃. bob.page.goto('/albums'). 로그아웃 버튼 클릭.
    - expect: Bob도 /login 으로 이동해야 한다.
  3. Alice: 로그아웃 후 page.goto('/albums') 시도.
    - expect: /login 으로 리다이렉트되어야 한다.
  4. Bob: 로그아웃 후 page.goto('/albums') 시도.
    - expect: /login 으로 리다이렉트되어야 한다.
