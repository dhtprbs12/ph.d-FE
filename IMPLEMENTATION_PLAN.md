# Nutrition Passport — Implementation Plan

## Overview

펫 사료 기록 시스템. 유저의 펫이 뭘 먹었고, 몸이 어떻게 반응했고, 앞으로 뭘 먹어야 하는지를 한곳에 쌓아가는 기능.

## Requirements

- **모든 코드는 Android와 iOS에서 정상 작동해야 한다.**
- 플랫폼별 분기가 필요한 경우 (카메라, 바코드 스캔, push notification 등) 반드시 양쪽 테스트 후 머지.
- 플랫폼 특화 라이브러리 선택 시 Android/iOS 모두 지원하는 라이브러리만 사용.

---

## Phase 0: DB Schema (0.5일) ✅ DONE

### products 테이블 (필드 추가)

| 필드 | 타입 | 설명 |
|------|------|------|
| `front_image_url` | VARCHAR(500) | 유저가 찍은 앞라벨 사진 |
| `ingredient_image_url` | VARCHAR(500) | 유저가 찍은 성분표 사진 |
| `barcode_image_url` | VARCHAR(500) | 유저가 찍은 바코드 사진 |
| `status` | ENUM('pending','verified') DEFAULT 'pending' | 검수 상태 |

> 기존 `image_url`은 API 공식 제품 이미지 용도로 유지

### pet_foods 테이블 (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(36) PRI | |
| `pet_id` | VARCHAR(36) FK → pets | |
| `product_id` | VARCHAR(36) FK → products (nullable) | |
| `scan_id` | VARCHAR(36) FK → scans (nullable) | |
| `product_name` | VARCHAR(300) | |
| `is_current` | BOOLEAN DEFAULT false | |
| `started_at` | DATE | |
| `ended_at` | DATE (nullable) | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### daily_checkins 테이블 (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(36) PRI | |
| `pet_id` | VARCHAR(36) FK → pets | |
| `pet_food_id` | VARCHAR(36) FK → pet_foods **(nullable)** | 현재 사료 미등록 상태에서도 체크인 가능 |
| `date` | DATE | |
| `stool_score` | TINYINT (1~5) | |
| `appetite` | ENUM('low','normal','high') | |
| `vomiting` | BOOLEAN | |
| `itching` | BOOLEAN | |
| `notes` | TEXT (nullable) | |
| `localDate` | DATE | 클라이언트 로컬 날짜 (타임존 처리용) |
| `created_at` | TIMESTAMP | |

> UNIQUE(pet_id, date) — 하루에 한 번만 체크인
> `pet_food_id`는 nullable — 현재 사료를 아직 안 정해도 건강 체크인은 가능.
> `localDate`는 클라이언트 디바이스의 로컬 날짜. 스트릭 계산 및 중복 체크인 방지에 사용.

---

## Phase 1: Breed Dropdown (1일)

### 목표

AddPetScreen breed 선택을 TextInput + filtered dropdown으로 교체

### Frontend

- TextInput에 타이핑하면 breed 목록 필터링
- 선택하면 자동완성
- AKC breed 목록 JSON (~200개) 앱에 번들

### 동작

```
[         mal         ]
┌─────────────────────┐
│ Maltese             │
│ Malamute            │
│ Malinois            │
└─────────────────────┘
```

---

## Phase 2: Product Pipeline (3일)

### 목표

바코드 스캔 → DB에 없으면 → 사진 3장 촬영 → 등록 → admin 검수

### 플로우

```
바코드 스캔
  → products DB 조회
  → 있음 → 제품 정보 표시 → "이 사료 맞아요?" → 확인
  → 없음 → "성분표 스캔해주세요"
         → 앞라벨 + 성분표 + 바코드 사진 3장 촬영
         → products INSERT (status: pending)
         → 사진 3장 Cloudflare 업로드
         → OCR + 분석 실행 (기존 플로우)
         → 유저에게 결과 즉시 표시
         → Slack #product-review 알림
```

> 유저는 기다리지 않음. 결과 즉시 표시. admin은 뒤에서 검수.
> 유저가 제출할수록 DB가 자동으로 채워지는 구조.

### Backend

- `POST /products/register` — 사진 업로드 + DB insert
- `GET /products/barcode/:code` — 바코드 조회
- Slack webhook 연동

### Frontend

- 바코드 스캔 화면
- 3장 촬영 플로우 (앞라벨 → 성분표 → 바코드)

---

## Phase 3: Current Food 등록 (1일)

### 목표

펫 등록 시 현재 사료 등록 + Home에서 사료 변경

### AddPetScreen 마지막 스텝

```
"덕구가 지금 먹는 사료는?"

[📱 바코드 스캔]  [📋 기록에서 선택]  [⏭ 나중에]
```

- 바코드 스캔 → Phase 2 플로우
- 기록에서 선택 → History 목록
- 나중에 → skip

### Backend

- `POST /pets/:id/current-food` — 현재 사료 등록
- `GET /pets/:id/current-food` — 현재 사료 조회
- `PUT /pets/:id/current-food` — 사료 변경 (이전 ended_at, 새 거 is_current)
- `GET /pets/:id/food-history` — 전체 사료 이력

---

## Phase 5: Home 개편 (2일)

### 목표

Home에 캐릭터/레벨 + 핵심 기능 버튼 + current food 카드 + check-in 진입점.
스캔 버튼은 반드시 **스크롤 없이 보이는 위치**에 배치.

> 이 화면은 GAMIFICATION_PLAN.md의 캐릭터/레벨/토큰 표시도 같이 구현한다.
> 기존 UserBadgeCard (scan-count 뱃지)는 새 스캔 레벨 시스템으로 교체한다.

### 화면

```
┌──────────────────────────────────┐
│  ┌──────────┐  ┌──────────────┐  │
│  │ [캐릭터]  │  │ Lv.5  🦴 145│  │  ← 캐릭터 + 레벨 + 토큰
│  │ 멍박사    │  │ 🔥 12일      │  │  ← 스트릭
│  └──────────┘  └──────────────┘  │
│                                  │
│  [📷 스캔] [🔍 검색] [🍎 체크]    │  ← 핵심 기능 (항상 보임)
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🐕 덕구 · Acana Pacifica  │  │  ← 현재 사료 (컴팩트)
│  │ Day 12  [Change] [체크인 →]│  │
│  └────────────────────────────┘  │
│                                  │
│  ...커뮤니티 등 나머지...          │
└──────────────────────────────────┘
```

### Change 탭 시

```
┌──────────────────────────┐
│  사료 변경                 │
│                           │
│  📋 스캔 기록에서 선택      │
│  📷 새 사료 스캔           │
│                           │
│  ──  최근 스캔  ──         │
│  Wild Prairie (91점)       │
│  Orijen Original (88점)   │
└──────────────────────────┘
```

선택 → "Wild Prairie로 변경할까요?" → 확인 → 끝.

---

## Phase 6: Daily Check-in (2일)

### 목표

매일 10초 체크인으로 증상 데이터 수집

### 화면

```
┌──────────────────────────┐
│  📝 Sep 8 Check-in       │
│  Acana Pacifica · Day 12 │
│                           │
│  💩 Stool                 │
│  [1 😫] [2 😕] [3 😐] [4 🙂] [5 😊]
│                           │
│  🍽 Appetite              │
│  [Low] [Normal] [High]   │
│                           │
│  🤮 Vomiting today?      │
│  [No] [Yes]              │
│                           │
│  🐾 Itching/Scratching?  │
│  [No] [Yes]              │
│                           │
│  💬 Notes (optional)      │
│  [                    ]   │
│                           │
│  [Save ✅]                │
└──────────────────────────┘
```

### Backend

- `POST /pets/:id/checkins` — 체크인 저장
- `GET /pets/:id/checkins?from=&to=` — 기간 조회
- `GET /pets/:id/checkins/summary` — 주간/월간 평균

> 체크인 API에 `localDate` (클라이언트 로컬 날짜) 필드 필수.
> 서버는 이 localDate 기준으로 중복 체크 및 스트릭 계산.
> 체크인 저장 완료 시 토큰 지급 + 스트릭 업데이트 (GAMIFICATION_PLAN Phase 4 참조).

### Home 연동

- 오늘 체크인 완료 여부 표시
- 이번 주 요약 (stool 평균, vomit/itch 횟수)

---

## Phase 7: Passport + Insights (3일)

### 목표

사료 이력 타임라인 + 성분-증상 상관관계 자동 발견

### Passport 화면

```
┌──────────────────────────┐
│  📊 덕구의 Nutrition Passport
│                           │
│  ── Timeline ──           │
│  Mar ▓▓▓ Royal Canin      │
│       💩 3.1  🐾 12회      │
│  Jun ▓▓▓ Orijen           │
│       💩 4.3  🐾 2회       │
│  Sep ▓▓▓ Acana            │
│       💩 4.1  🐾 1회       │
│                           │
│  ── Insights ──           │
│  💡 Chicken → 가려움 상관   │
│  💡 식이섬유 4~6% 최적      │
└──────────────────────────┘
```

### Insight 상세

```
┌──────────────────────────┐
│  💡 Chicken Connection   │
│                           │
│  🍗 Chicken 포함          │
│  Royal Canin (Mar~Jun)   │
│  → 가려움 월평균 12회      │
│                           │
│  🐟 Chicken 미포함        │
│  Orijen (Jun~Sep)        │
│  → 가려움 월평균 2회       │
│                           │
│  ⚠️ 상관관계이며 인과관계를  │
│  증명하지 않습니다.         │
│  수의사 상담을 권장합니다.   │
└──────────────────────────┘
```

### Backend

- `GET /pets/:id/passport` — timeline + food history + 기간별 증상 평균
- `GET /pets/:id/insights` — 성분-증상 상관관계 분석

### Insight 로직 (단순 통계)

```
각 food 기간별 증상 평균 계산
각 성분별:
  - 포함된 사료 기간들의 증상 평균
  - 미포함 기간들의 증상 평균
  - 차이가 유의미하면 → Insight 카드 생성
```

> AI 불필요. 단순 통계로 충분.

---

## 일정 요약

| Phase | 내용 | 기간 |
|-------|------|------|
| Phase 0 | DB Schema | 0.5일 |
| Phase 1 | Breed Dropdown | 1일 |
| Phase 2 | Product Pipeline | 3일 |
| Phase 3 | Current Food 등록 | 1일 |
| Phase 5 | Home 개편 | 2일 |
| Phase 6 | Daily Check-in | 2일 |
| Phase 7 | Passport + Insights | 3일 |
| **Total** | | **~12일** |

```
Week 1:  Phase 0 → 1 → 2 → 3
Week 2:  Phase 5 → 6
Week 3:  Phase 7
```

---

## 새 화면 목록

| 화면 | 유형 |
|------|------|
| 바코드 스캔 화면 | 새로 |
| 3장 촬영 플로우 | 새로 |
| CheckInScreen | 새로 |
| PassportScreen | 새로 |
| InsightDetailScreen | 새로 |
| Home | 기존 수정 |
| AddPetScreen | 기존 수정 |
| ResultScreen | 기존 수정 |
