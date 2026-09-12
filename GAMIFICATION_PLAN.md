# 🐾 Gamification & Character Customization — Implementation Plan

## Overview

PHD 앱에 게이미피케이션 시스템을 도입한다.
핵심 루프: **건강 체크인 → 토큰(🦴) 획득 → 마스코트 캐릭터 꾸미기**
참고 모델: 말해보카 (미션 → 토큰 → 캐릭터 꾸미기)

## Requirements

- 모든 코드는 Android와 iOS에서 정상 작동해야 한다.
- 기존 스캔/분석 기능에 영향 없이 독립적으로 동작해야 한다.
- 에셋 기반 PNG 레이어 방식 — AI 실시간 생성 아님.
- 기본 마스코트 2종 (강아지 "멍박사", 고양이 "냥박사") 공용 캐릭터.

---

## 🦴 토큰 이코노미

토큰 소스는 **3가지만** 존재한다. 단순하고 명확하게.

### 초기 토큰

신규 유저 가입 시 **🦴 ×10** 환영 보너스 지급. 기본 아이템 하나를 바로 살 수 있게.

### 1. 건강 체크인 (매일 1회)

유저가 매일 펫의 건강 상태(대변, 식욕, 가려움 등)를 기록하면 토큰 지급.
체크인은 **노력이 필요한 행동**이며, 앱의 핵심 데이터(Nutrition Passport)를 축적한다.

| 행동 | 토큰 |
|------|------|
| 건강 체크인 완료 | 🦴 ×5 |

> 하루 최대: **🦴 ×5**
> 앱 접속, 스캔, 커뮤니티 구경 등 "그냥 하는 행동"에는 토큰 없음.

### 2. 신규 제품 등록 (수시)

DB에 없는 제품을 유저가 앞라벨 + 성분표 + 바코드 3장 촬영하여 등록.
유저의 노력이 크고, 앱 DB 확장에 직접 기여하므로 높은 보상.

| 행동 | 토큰 |
|------|------|
| 신규 제품 등록 완료 | 🦴 ×20 |

### 3. 스캔 레벨 달성 (마일스톤)

누적 스캔 횟수에 따른 레벨업. 레벨이 올라갈수록 간격이 벌어지고 보상도 커진다.

| 레벨 | 누적 스캔 | 토큰 | 도달 체감 |
|------|----------|------|----------|
| Lv.2 | 5회 | 🦴 ×5 | 하루면 도달 |
| Lv.3 | 15회 | 🦴 ×5 | 2~3일 |
| Lv.4 | 30회 | 🦴 ×10 | 1주 |
| Lv.5 | 50회 | 🦴 ×10 | 2주 |
| Lv.6 | 80회 | 🦴 ×15 | 한 달 |
| Lv.7 | 120회 | 🦴 ×15 | 한 달 반 |
| Lv.8 | 170회 | 🦴 ×20 | 두세 달 |
| Lv.9 | 250회 | 🦴 ×25 | 반 년 |
| Lv.10 | 400회 | 🦴 ×50 | 헤비 유저만 |

### 스트릭 보너스 (건강 체크인 연속 달성)

| 연속 일수 | 보너스 토큰 |
|-----------|------------|
| 7일 | 🦴 ×10 |
| 30일 | 🦴 ×30 |
| 100일 | 🦴 ×50 |

### 밸런스 시뮬레이션

**꾸준한 유저 (매일 체크인 + 주 3~4회 스캔):**

```
월간:
  체크인 30일 × 🦴5          = 🦴 150
  스트릭 7일 ×4              = 🦴  40
  스트릭 30일 ×1             = 🦴  30
  스캔 레벨업 (2~3달에 1회)   = 🦴 ~5 (월 평균)
  제품 등록 (가끔)            = 🦴 ~7 (월 평균)
  ────────────────────────
  월 합계:                    ~🦴 230
```

**가끔 하는 유저 (주 2~3회 접속):**

```
월간:
  체크인 10일 × 🦴5           = 🦴  50
  스트릭 보너스               = 🦴   0 (연속 안 되므로)
  스캔 레벨업                 = 🦴  ~3
  ────────────────────────
  월 합계:                    ~🦴  53
```

### 아이템 가격표

| 등급 | 가격 | 꾸준한 유저 | 가끔 유저 |
|------|------|-----------|----------|
| 기본 (야구모자, 반다나) | 🦴 8~15 | 2~3일 | 1~2주 |
| 중간 (선글라스, 넥타이) | 🦴 20~30 | 4~6일 | 3~4주 |
| 고급 (왕관, 망토) | 🦴 40~60 | 2주 | 2달 |
| 시즌 한정 (산타모자) | 🦴 80~100 | 한 달 | 못 삼 → 체크인 동기 |

---

## Phase 1: DB Schema (0.5일) ✅ DONE

> 게이미피케이션 테이블 7개 마이그레이션 완료.

### 테이블 초기화

유저 가입 시 (`POST /auth/register` 성공 후) 아래 4개 행을 함께 생성:

```
INSERT user_tokens     → balance: 10 (환영 보너스), total_earned: 10
INSERT user_scan_level → total_scans: 0, current_level: 1
INSERT user_streaks    → current_streak: 0, longest_streak: 0
INSERT user_equipped   → character_type: 'dog' (기본값)
```

### user_tokens 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | VARCHAR(36) PRI, FK → users | |
| `balance` | INT DEFAULT 0 | 현재 보유 토큰 |
| `total_earned` | INT DEFAULT 0 | 누적 획득 토큰 |
| `total_spent` | INT DEFAULT 0 | 누적 사용 토큰 |
| `updated_at` | TIMESTAMP | |

### token_transactions 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(36) PRI | |
| `user_id` | VARCHAR(36) FK → users | |
| `amount` | INT | 양수: 획득, 음수: 사용 |
| `type` | ENUM('checkin', 'product_register', 'scan_level', 'streak', 'purchase') | |
| `reference_id` | VARCHAR(100) NULL | 체크인ID, 제품ID, 레벨, 아이템ID 등 |
| `description` | VARCHAR(300) | "건강 체크인 완료" 등 |
| `created_at` | TIMESTAMP | |

### user_scan_level 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | VARCHAR(36) PRI, FK → users | |
| `total_scans` | INT DEFAULT 0 | 누적 스캔 횟수 |
| `current_level` | INT DEFAULT 1 | 현재 레벨 |
| `updated_at` | TIMESTAMP | |

### user_streaks 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | VARCHAR(36) PRI, FK → users | |
| `current_streak` | INT DEFAULT 0 | 현재 연속 일수 |
| `longest_streak` | INT DEFAULT 0 | 최장 연속 기록 |
| `last_checkin_date` | DATE NULL | 마지막 체크인 날짜 |
| `updated_at` | TIMESTAMP | |

### shop_items 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(36) PRI | |
| `category` | ENUM('hat', 'glasses', 'accessory', 'clothes', 'background', 'effect') | |
| `name` | VARCHAR(100) | "왕관", "선글라스" 등 |
| `name_ko` | VARCHAR(100) | 한국어 이름 |
| `price` | INT | 토큰 가격 |
| `asset_key` | VARCHAR(100) | 에셋 파일명 (예: `hat_crown`) |
| `layer_type` | ENUM('head', 'eyes', 'body', 'background', 'overlay') | 렌더링 레이어 |
| `position_x` | INT | 캐릭터 기준 X 오프셋 |
| `position_y` | INT | 캐릭터 기준 Y 오프셋 |
| `is_seasonal` | BOOLEAN DEFAULT false | 시즌 한정 여부 |
| `available_from` | DATE NULL | 판매 시작일 (시즌용) |
| `available_until` | DATE NULL | 판매 종료일 (시즌용) |
| `sort_order` | INT DEFAULT 0 | 정렬 순서 |
| `created_at` | TIMESTAMP | |

### user_items 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(36) PRI | |
| `user_id` | VARCHAR(36) FK → users | |
| `item_id` | VARCHAR(36) FK → shop_items | |
| `purchased_at` | TIMESTAMP | |

> UNIQUE(user_id, item_id)

### user_equipped 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | VARCHAR(36) PRI, FK → users | |
| `character_type` | ENUM('dog', 'cat') DEFAULT 'dog' | 멍박사/냥박사 선택 |
| `hat_item_id` | VARCHAR(36) NULL FK → shop_items | |
| `glasses_item_id` | VARCHAR(36) NULL FK → shop_items | |
| `accessory_item_id` | VARCHAR(36) NULL FK → shop_items | |
| `clothes_item_id` | VARCHAR(36) NULL FK → shop_items | |
| `background_item_id` | VARCHAR(36) NULL FK → shop_items | |
| `effect_item_id` | VARCHAR(36) NULL FK → shop_items | |
| `updated_at` | TIMESTAMP | |

---

## Phase 2: 에셋 제작 (1~2일)

### 필요 에셋 목록

앱에 번들되는 투명 배경 PNG 파일들. 모든 에셋은 동일한 캔버스 크기 (예: 300×300px)에 위치 기준점이 맞춰져야 한다.

```
assets/character/
├── bases/
│   ├── dog_base.png              ← 멍박사 기본 몸체
│   └── cat_base.png              ← 냥박사 기본 몸체
│
├── hats/
│   ├── hat_crown.png             ← 왕관
│   ├── hat_santa.png             ← 산타모자
│   ├── hat_baseball.png          ← 야구모자
│   ├── hat_beanie.png            ← 비니
│   ├── hat_graduation.png        ← 졸업모자
│   ├── hat_flower.png            ← 꽃 화관
│   ├── hat_ribbon.png            ← 리본
│   └── hat_beret.png             ← 베레모
│
├── glasses/
│   ├── glasses_sun.png           ← 선글라스
│   ├── glasses_round.png         ← 동그란 안경
│   ├── glasses_heart.png         ← 하트 선글라스
│   ├── glasses_star.png          ← 별 안경
│   └── glasses_goggle.png        ← 고글
│
├── accessories/
│   ├── acc_bowtie.png            ← 나비넥타이
│   ├── acc_necktie.png           ← 넥타이
│   ├── acc_scarf.png             ← 스카프
│   ├── acc_necklace.png          ← 목걸이
│   └── acc_bandana.png           ← 반다나
│
├── clothes/
│   ├── clothes_cape.png          ← 망토
│   ├── clothes_hoodie.png        ← 후디
│   ├── clothes_tuxedo.png        ← 턱시도
│   ├── clothes_doctor.png        ← 의사 가운 (테마)
│   └── clothes_superhero.png     ← 슈퍼히어로
│
├── backgrounds/
│   ├── bg_default.png            ← 기본 파스텔
│   ├── bg_stars.png              ← 별
│   ├── bg_hearts.png             ← 하트
│   ├── bg_rainbow.png            ← 무지개
│   └── bg_nature.png             ← 자연
│
├── effects/
│   ├── effect_sparkle.png        ← 반짝이
│   ├── effect_hearts.png         ← 하트 이펙트
│   ├── effect_stars.png          ← 별 이펙트
│   └── effect_fire.png           ← 불꽃 이펙트
│
└── thumbnails/                   ← 샵 그리드용 작은 미리보기
    ├── thumb_hat_crown.png
    ├── thumb_glasses_sun.png
    └── ... (모든 아이템)
```

**총 에셋: ~37장 + 썸네일 37장 = 약 74장**

### 에셋 제작 방법

1. AI 도구(Midjourney, DALL-E)로 캐릭터 베이스 2종 생성
2. 동일한 스타일 프롬프트로 아이템 개별 생성
3. Figma/Photoshop에서 투명 배경 처리 + 캔버스 크기 통일 + 위치 조정
4. 앱 assets 폴더에 번들

### 에셋 스타일 가이드

- **스타일**: 치비/카와이, 두꺼운 아웃라인, 파스텔 컬러
- **캔버스**: 300×300px (2x 해상도 기준)
- **배경**: 투명 (PNG-24)
- **시점**: 정면
- **컬러**: 앱 테마와 조화 (primary green, accent orange, cream 계열)

---

## Phase 3: 토큰 시스템 — Backend (1일)

### API Endpoints

#### 토큰 조회

```
GET /users/me/tokens
Response: {
  balance: 145,
  totalEarned: 520,
  totalSpent: 375
}
```

#### 토큰 트랜잭션 내역

```
GET /users/me/tokens/history?limit=20&offset=0
Response: {
  transactions: [
    { id, amount: 5, type: 'checkin', description: '건강 체크인 완료', createdAt },
    { id, amount: -15, type: 'purchase', description: '선글라스 구매', createdAt },
    ...
  ]
}
```

---

## Phase 4: 건강 체크인 토큰 연동 — Backend (0.5일)

기존 IMPLEMENTATION_PLAN.md의 Phase 6 (Daily Check-in) 완료 시 토큰 자동 지급.

### 트리거

```
POST /pets/:id/checkins  (기존 API)
  → 체크인 저장 완료 후
  → 오늘 이미 토큰 받았는지 확인 (중복 방지)
  → 미수령 시 🦴 ×5 지급
  → 스트릭 업데이트
  → 스트릭 마일스톤 달성 시 보너스 지급
```

### 스트릭 로직

> 스트릭 날짜 비교는 **클라이언트가 보내는 `localDate`** 기준.
> 미국 유저 타겟이므로 서버 시간이 아닌 디바이스 로컬 시간 사용.

```
체크인 시 (localDate = 클라이언트 로컬 날짜):
  if lastCheckinDate == localDate - 1일 → currentStreak++
  if lastCheckinDate == localDate → 변화 없음
  if lastCheckinDate < localDate - 1일 → currentStreak = 1 (리셋)
  lastCheckinDate = localDate
  if currentStreak > longestStreak → longestStreak = currentStreak
  if currentStreak in [7, 30, 100] → 보너스 토큰 지급
```

### API

```
GET /users/me/streak
Response: {
  currentStreak: 12,
  longestStreak: 23,
  lastCheckinDate: '2026-09-08',
  milestones: [
    { days: 7, reward: 10, reached: true, rewardClaimed: true },
    { days: 30, reward: 30, reached: false },
    { days: 100, reward: 50, reached: false }
  ]
}
```

---

## Phase 5: 신규 제품 등록 토큰 연동 — Backend (0.5일)

기존 IMPLEMENTATION_PLAN.md의 Phase 2 (Product Pipeline) 완료 시 토큰 지급.

### 트리거

```
POST /products/register  (기존 API)
  → 앞라벨 + 성분표 + 바코드 3장 제출 완료
  → 🦴 ×20 지급
```

---

## Phase 6: 스캔 레벨 시스템 — Backend (0.5일)

### 레벨 테이블 (하드코딩)

```
SCAN_LEVELS = [
  { level: 1,  scansRequired: 0,   reward: 0  },
  { level: 2,  scansRequired: 5,   reward: 5  },
  { level: 3,  scansRequired: 15,  reward: 5  },
  { level: 4,  scansRequired: 30,  reward: 10 },
  { level: 5,  scansRequired: 50,  reward: 10 },
  { level: 6,  scansRequired: 80,  reward: 15 },
  { level: 7,  scansRequired: 120, reward: 15 },
  { level: 8,  scansRequired: 170, reward: 20 },
  { level: 9,  scansRequired: 250, reward: 25 },
  { level: 10, scansRequired: 400, reward: 50 },
]
```

### 트리거

```
스캔 완료 시 (기존 스캔 API 후처리):
  → user_scan_level.total_scans++
  → 다음 레벨 scansRequired 도달 여부 체크
  → 도달 시 → current_level++, 토큰 지급
```

> 기존 HomeScreen의 UserBadgeCard (scan-count 뱃지, `/scan/user-stats`)는
> 이 스캔 레벨 시스템으로 **교체**한다. 별도 공존 없음.

### API

```
GET /users/me/scan-level
Response: {
  currentLevel: 5,
  totalScans: 62,
  nextLevel: {
    level: 6,
    scansRequired: 80,
    reward: 15,
    progress: { current: 62, target: 80 }
  }
}
```

---

## Phase 7: 아이템 샵 & 꾸미기 — Backend (1일)

### API Endpoints

#### 샵 아이템 목록

```
GET /shop/items?category=hat
Response: {
  items: [
    { id, category: 'hat', name: '왕관', nameKo: '왕관', price: 20,
      assetKey: 'hat_crown', layerType: 'head',
      positionX: 120, positionY: 10,
      isSeasonal: false, isOwned: false },
    ...
  ]
}
```

#### 아이템 구매

```
POST /shop/items/:id/purchase
Response: {
  success: true,
  item: { ... },
  newBalance: 125
}
// 실패 시: { success: false, error: 'insufficient_tokens' }
```

#### 장착 상태 조회

```
GET /users/me/character
Response: {
  characterType: 'dog',
  equipped: {
    hat: { id, assetKey: 'hat_crown', positionX: 120, positionY: 10 },
    glasses: null,
    accessory: { id, assetKey: 'acc_bowtie', positionX: 130, positionY: 120 },
    clothes: null,
    background: { id, assetKey: 'bg_default' },
    effect: null
  },
  ownedItems: ['item_id_1', 'item_id_2', ...]
}
```

#### 장착 변경

```
PUT /users/me/character/equip
Body: {
  slot: 'hat',           // 'hat' | 'glasses' | 'accessory' | 'clothes' | 'background' | 'effect'
  itemId: 'item_123'     // null이면 해제
}
Response: { success: true, equipped: { ... } }
```

---

## Phase 8: 캐릭터 꾸미기 화면 — Frontend (2일)

### CharacterScreen

말해보카와 동일한 레이아웃.

```
┌──────────────────────────────────┐
│  ← 캐릭터 꾸미기         🦴 170  │
│                                  │
│  ┌────────────────────────────┐  │
│  │        [배경 레이어]         │  │
│  │        [캐릭터 몸체]         │  │
│  │        [옷 레이어]          │  │
│  │        [악세서리 레이어]      │  │
│  │        [안경 레이어]         │  │
│  │        [모자 레이어]         │  │
│  │        [이펙트 레이어]       │  │
│  │                            │  │
│  │    "멍박사"  Lv.12          │  │
│  └────────────────────────────┘  │
│                                  │
│──────────────────────────────────│
│                                  │
│  [추천] [안경] [모자] [악세서리] [옷] [배경] [이펙트] │
│                                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │item│ │item│ │item│ │item│   │
│  │    │ │    │ │    │ │    │   │
│  └────┘ └────┘ └────┘ └────┘   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │item│ │item│ │item│ │item│   │
│  │    │ │    │ │    │ │    │   │
│  └────┘ └────┘ └────┘ └────┘   │
│                                  │
│         [ 저장하기 ]              │
└──────────────────────────────────┘
```

### 컴포넌트 구조

```
src/screens/CharacterScreen.tsx
├── CharacterCanvas              ← 캐릭터 렌더링 영역 (Image 레이어 합성)
│   ├── Image (background)
│   ├── Image (base: dog or cat)
│   ├── Image (clothes)
│   ├── Image (accessory)
│   ├── Image (glasses)
│   ├── Image (hat)
│   └── Image (effect)
│
├── CategoryTabs                 ← 카테고리 탭 바 (추천/안경/모자/...)
│   └── ScrollView horizontal
│       └── TouchableOpacity × N
│
├── ItemGrid                     ← 아이템 그리드
│   └── FlatList (numColumns: 4)
│       └── ItemCard
│           ├── Image (thumbnail)
│           ├── 가격 or "장착중" 표시
│           └── 🔒 잠김 표시 (시즌 미도래)
│
└── ActionBar                    ← 하단 버튼
    ├── 구매 버튼 (미보유 아이템 선택 시)
    └── 저장 버튼 (보유 아이템 장착 변경 시)
```

### 인터랙션 플로우

```
아이템 터치
  → 보유한 아이템?
    → YES: 캐릭터 캔버스에 즉시 미리보기 반영 (로컬 state만 변경)
           → "저장" 누르면 서버에 equip API 호출
    → NO:  캐릭터 캔버스에 미리보기 반영 (반투명)
           → "🦴 20으로 구매" 버튼 표시
           → 구매 확인 → 서버 purchase API → 잔액 차감 → 자동 장착
```

---

## Phase 9: 홈화면 + 보상 연출 — Frontend (1.5일)

### HomeScreen에 추가할 요소

기존 HomeScreen과 통합. 스캔 버튼은 **스크롤 없이 보이는 위치**에 배치.

> 이 화면은 IMPLEMENTATION_PLAN.md Phase 5 (Home 개편)과 같이 빌드한다.
> 기존 UserBadgeCard는 새 레벨/토큰 표시로 교체.

```
┌──────────────────────────────────┐
│  ┌──────────┐  ┌──────────────┐  │
│  │ [캐릭터]  │  │ Lv.5  🦴 145│  │  ← GM: 캐릭터 + 레벨 + 토큰
│  │ 멍박사    │  │ 🔥 12일      │  │  ← GM: 스트릭
│  └──────────┘  └──────────────┘  │
│  캐릭터 터치 → CharacterScreen    │
│                                  │
│  [📷 스캔] [🔍 검색] [🍎 체크]    │  ← 핵심 기능 (항상 보임)
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🐕 덕구 · Acana Pacifica  │  │  ← NP: 현재 사료 (컴팩트)
│  │ Day 12  [Change] [체크인 →]│  │  ← NP: 체크인 진입점
│  └────────────────────────────┘  │
│                                  │
│  ...커뮤니티 등 나머지...          │
└──────────────────────────────────┘
```

### 보상 연출

#### 체크인 완료 시 토스트

```
┌──────────────────────┐
│  ✅ 건강 체크인 완료!  │
│  🦴 +5 획득!          │  ← 토큰이 위로 날아가는 애니메이션
└──────────────────────┘
```

#### 레벨업 시 모달

```
┌──────────────────────┐
│     🎉 레벨 업!       │
│                      │
│   Lv.5 → Lv.6       │
│   🦴 ×15 획득!       │
│                      │
│   [확인]             │
└──────────────────────┘
```

#### 스트릭 마일스톤 시 모달

```
┌──────────────────────┐
│    🔥🔥🔥🔥🔥🔥🔥     │
│                      │
│   7일 연속 체크인!     │
│   대단해요! 🎉        │
│                      │
│   🦴 ×10 획득!       │
│   [확인]             │
└──────────────────────┘
```

- `react-native-reanimated` 바운스/스프링 애니메이션
- confetti 파티클 효과

---

## Phase 10: 프로필/캐릭터 연동 (0.5일)

### 캐릭터가 표시되는 곳

| 위치 | 표시 방식 |
|------|-----------|
| HomeScreen 상단 | 꾸민 캐릭터 미니 아바타 (터치 → 꾸미기 화면) |
| CommunityScreen | 커뮤니티 피드 유저 아바타 → 꾸민 캐릭터 |
| SettingsScreen | 프로필 영역에 캐릭터 |
| 공유 카드 | ResultScreen 공유 시 캐릭터 포함 |

### 캐릭터 미니 렌더링

캐릭터 캔버스를 축소 렌더링하는 `MiniCharacter` 컴포넌트.

```tsx
<MiniCharacter size={60} />  // HomeScreen 아바타
<MiniCharacter size={40} />  // 커뮤니티 피드
<MiniCharacter size={80} />  // 프로필
```

---

## Navigation 변경

### 새 화면 추가

| 화면 | 스택 | 진입점 |
|------|------|--------|
| `CharacterScreen` | HomeStack | HomeScreen 캐릭터 터치, SettingsScreen |

### 탭바

기존 5탭 유지. Home 탭 내에서 캐릭터 진입 가능.

---

## 새 서비스 파일

```
src/services/
├── gamificationService.ts      ← 토큰, 스트릭, 스캔레벨 API
└── shopService.ts              ← 샵 아이템, 구매, 장착 API
```

---

## 일정 요약

| Phase | 내용 | 기간 | 의존성 |
|-------|------|------|--------|
| Phase 1 | DB Schema | 0.5일 | — |
| Phase 2 | 에셋 제작 | 1~2일 | — (병렬 가능) |
| Phase 3 | 토큰 시스템 BE | 1일 | Phase 1 |
| Phase 4 | 체크인 토큰 연동 BE | 0.5일 | Phase 3 |
| Phase 5 | 제품 등록 토큰 연동 BE | 0.5일 | Phase 3 |
| Phase 6 | 스캔 레벨 시스템 BE | 0.5일 | Phase 3 |
| Phase 7 | 아이템 샵 BE | 1일 | Phase 1 |
| Phase 8 | 캐릭터 꾸미기 FE | 2일 | Phase 2, 7 |
| Phase 9 | 홈화면 + 보상 연출 FE | 1.5일 | Phase 4, 5, 6 |
| Phase 10 | 프로필 연동 FE | 0.5일 | Phase 8 |
| **Total** | | **~9일** | |

### 병렬 작업 가능 구간

```
Week 1:  Phase 1 (DB) → Phase 3/4/5/6 (Backend 토큰 + 연동)
         Phase 2 (에셋 제작 — 병렬)
Week 2:  Phase 7 (샵 BE) → Phase 8 (꾸미기 FE) → Phase 9 (홈 + 연출)
         Phase 10 (연동)
```

---

## 새 화면 목록

| 화면 | 파일 | 유형 |
|------|------|------|
| CharacterScreen | `src/screens/CharacterScreen.tsx` | 신규 |
| HomeScreen | `src/screens/HomeScreen.tsx` | 수정 (캐릭터 + 레벨 + 토큰 표시) |
| SettingsScreen | `src/screens/SettingsScreen.tsx` | 수정 (프로필에 캐릭터) |
| CommunityScreen | `src/screens/CommunityScreen.tsx` | 수정 (피드 아바타) |
| ResultScreen | `src/screens/ResultScreen.tsx` | 수정 (공유 카드에 캐릭터) |
