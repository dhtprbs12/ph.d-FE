# 결제 구현 계획

토큰은 상점에서 옷을 살 때만 쓴다. 구독은 인사이트 상세와 수의사 PDF만 연다.

공짜로 두는 것: 매일 기록, 디비에 있는 사료 점수, 성분 설명, Similar Products 전부, 펫 추가, 분석 요청, 사료별 변·가려움·구토 숫자, 이미 연 리포트. 인사이트가 없으면 결제 창도 없다.

분석이 끝났을 때 주던 뼈다귀는 그대로다. 하루 기록 5개와 상점 옷 가격도 그대로다.

결제는 앱에 아직 없다. 스토어 상품과 영수증 확인을 먼저 붙이고, 그다음 인사이트만 막는다. Expo Go에서는 결제가 안 되고 개발 빌드에서만 된다.

## 1. 스토어 상품

실결제용과 테스트용을 스토어에 각각 만든다. 청구 금액은 애플과 구글 상품에 붙은 가격이다. 서버 env에 `4.99`를 넣는다고 그 금액이 청구되지 않는다.

화면의 가격 숫자는 우리 코드에 적지 않는다. 스토어가 내려준 가격 문자열을 그대로 보여 준다. 그래서 테스트 상품으로 바꾸면 시트 금액도 같이 바뀐다.

| 용도 | 상품 id | 종류 | 실결제 가격 |
| --- | --- | --- | --- |
| 구독 | phd_plus_monthly | 자동 갱신 구독 | $4.99/월 |
| 구독 | phd_plus_yearly | 자동 갱신 구독 | $39.99/년 |
| 뼈다귀 | bones_50 | 소모품 | $1.99, 지급 50 |
| 뼈다귀 | bones_100 | 소모품 | 스토어에 넣은 가격, 지급 100 |
| 뼈다귀 | bones_200 | 소모품 | $4.99, 지급 200 |
| 뼈다귀 | bones_500 | 소모품 | $9.99, 지급 500 |
| 테스트 구독 | phd_plus_monthly_test | 자동 갱신 구독 | 그 스토어의 최저가 |
| 테스트 구독 | phd_plus_yearly_test | 자동 갱신 구독 | 그 스토어의 최저가 |
| 테스트 뼈다귀 | bones_50_test, bones_200_test, bones_500_test | 소모품 | 그 스토어의 최저가, 지급 개수는 실결제와 같음 |

샌드박스 계정과 Play 라이선스 테스터는 카드에서 돈이 나가지 않는다. 테스트 대부분은 이 계정으로 한다.

최저가 상품은 진짜 카드로 한 번 확인할 때 쓴다. 애플은 TestFlight도 샌드박스라서, 진짜 카드 결제는 출시된 앱에서만 된다. 안드로이드는 내부 테스트 트랙에서 라이선스 테스터가 아닌 계정으로 사면 진짜로 청구된다.

영수증은 RevenueCat으로 받아서 우리 서버가 웹훅으로 확인한다. 폰이 샀다고 말하는 것만으로는 구독을 열지 않는다.

## 2. 애플에 필요한 것

- Apple Developer Program에 가입된 팀. 앱의 번들 id는 EAS에 있는 것과 같다.
- App Store Connect에서 유료 앱 계약, 은행 계좌, 세금 양식이 완료돼 있다. 이게 없으면 샌드박스 구매도 실패한다.
- 구독 그룹 `PHD Plus`. 월간과 연간이 이 그룹 안에 있다. 테스트 구독도 같은 그룹에 둔다.
- 소모품 세 개와 테스트 소모품 세 개. 각 상품은 준비됨 상태이고, 표시 이름, 설명, 심사용 스크린샷이 있다.
- 처음 만든 인앱 상품과 구독은 앱 버전 하나와 같이 심사에 낸다. 심사 전에도 샌드박스에서는 살 수 있다.
- 이용약관(EULA)과 개인정보 처리방침 URL. 구독 시트와 App Store 설명에 둘 다 있어야 심사를 통과한다.
- App Store Connect API 키. Issuer ID, Key ID, `.p8`. 이 키를 RevenueCat의 애플 앱 설정에 올린다. 키 파일은 깃에 넣지 않는다.
- App Store 서버 알림 URL은 RevenueCat이 알려 주는 주소를 붙인다.
- 기기 설정에 샌드박스 Apple ID. 앱스토어에 로그인된 실계정으로 구매 테스트를 하지 않는다.
- 개발 빌드. Expo Go에는 StoreKit이 없다.

## 3. 안드로이드에 필요한 것

- Play Console에 이 앱의 applicationId로 등록된 앱. 결제 프로필이 있다.
- 같은 상품 id로 구독 두 개, 인앱 상품 세 개, 그리고 테스트용 다섯 개. 구독은 기본 요금제가 활성화돼 있다.
- 내부 테스트 트랙에 개발 빌드 AAB가 올라가 있고, 테스트하는 구글 계정이 그 트랙 테스터다. 트랙에 없으면 상품 목록이 비어서 온다.
- 라이선스 테스터. 이 계정은 테스트 카드로 결제하고 실제 청구되지 않는다.
- Play Console API 접근용 서비스 계정. JSON 키를 RevenueCat의 안드로이드 앱 설정에 올린다. 이 계정은 Play Console에서 재무 데이터 보기 권한이 있다. JSON은 깃에 넣지 않는다.
- 실시간 개발자 알림은 RevenueCat이 알려 주는 Pub/Sub 주제를 붙인다.

## 4. RevenueCat과 env

RevenueCat 프로젝트에 애플 앱과 구글 앱을 둔다. 권한 이름은 `plus`다. 월간과 연간, 테스트 월간과 테스트 연간이 이 권한에 연결된다.

오퍼링은 두 개다. `live`에는 실결제 상품 다섯 개, `test`에는 테스트 상품 다섯 개.

앱은 빌드할 때 다음 env를 읽는다.

```
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=
EXPO_PUBLIC_BILLING_TIER=test
```

`EXPO_PUBLIC_BILLING_TIER`가 `test`면 오퍼링 `test`를 보여주고, `live`면 오퍼링 `live`를 보여 준다. 가격 숫자는 오퍼링 안의 스토어 상품에서 온다. 테스트로 낮추려면 스토어의 테스트 상품 가격을 최저가로 두고 이 값을 `test`로 둔다. 출시 빌드는 `live`다.

앱 코드에는 상품 id를 적지 않는다. 앱은 RevenueCat에 지금 오퍼링을 물어보고, 거기에 연결된 상품과 스토어 가격을 그대로 보여 준다. 상품을 나중에 만들거나 테스트 상품으로 바꿔도 앱 코드는 그대로 둔다. 어떤 상품이 구독이고 뼈다귀를 몇 개 줄지는 서버 env만 본다.

앱이 아는 건 오퍼링 안의 패키지 이름뿐이다. 두 오퍼링 모두 같은 이름을 쓴다.

| 패키지 | 들어가는 상품 |
| --- | --- |
| `$rc_monthly` | 월간 구독 |
| `$rc_annual` | 연간 구독 |
| `bones_small` | 뼈다귀 50 |
| `bones_100` | 뼈다귀 100 |
| `bones_medium` | 뼈다귀 200 |
| `bones_large` | 뼈다귀 500 |

구독 시트는 `$rc_monthly`와 `$rc_annual`을, 뼈다귀 시트는 `bones_`로 시작하는 패키지를 그린다. 오퍼링에 패키지가 없으면 그 버튼은 숨긴다.

결제 버튼은 로그인한 유저에게만 보인다. RevenueCat 유저 id는 우리 `users.id`다. 익명 id로 산 구매는 서버가 누구에게 줄지 모른다. 로그아웃하면 RevenueCat에서도 로그아웃한다.

플러그인은 `react-native-purchases`다. 개발 빌드를 새로 만들어야 들어간다.

서버 env는 다음과 같다.

```
REVENUECAT_WEBHOOK_SECRET=
REVENUECAT_SECRET_API_KEY=
BILLING_PLUS_PRODUCT_IDS=phd_plus_monthly,phd_plus_yearly,phd_plus_monthly_test,phd_plus_yearly_test
BILLING_BONE_GRANTS=bones_50:50,bones_100:100,bones_200:200,bones_500:500,bones_50_test:50,bones_100_test:100,bones_200_test:200,bones_500_test:500
BILLING_ALLOW_SANDBOX=true
```

`BILLING_PLUS_PRODUCT_IDS`에 있는 상품만 구독으로 인정한다. `BILLING_BONE_GRANTS`의 쌍이 그 상품을 샀을 때 넣을 뼈다귀 수다. 테스트 상품도 같은 개수를 준다. 금액만 싸다.

`BILLING_ALLOW_SANDBOX`가 `true`일 때만 샌드박스 구매를 반영한다. 출시하면 `false`로 둔다. TestFlight 구매는 전부 샌드박스라서, 이 값을 켜 두면 TestFlight 유저가 실서버에서 돈 안 내고 Plus를 연다.

폰은 로그인한 유저 id로 RevenueCat에 로그인한다. 구매와 복원 뒤에 서버 상태를 다시 읽는다. 웹훅이 늦으면 짧은 간격으로 몇 번만 다시 읽는다.

## 5. 서버

새 테이블은 없다. 테이블 두 개를 고친다. 마이그레이션 파일로 만들고, 실행은 Workbench에서 직접 한다.

```sql
ALTER TABLE users
  ADD COLUMN plus_product_id VARCHAR(80) NULL,
  ADD COLUMN plus_store ENUM('apple', 'google') NULL,
  ADD COLUMN plus_will_renew TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN plus_expires_at TIMESTAMP NULL;

ALTER TABLE token_transactions
  MODIFY COLUMN type ENUM('checkin', 'product_register', 'scan_level', 'streak', 'purchase', 'bone_pack') NOT NULL;
```

`purchase`는 지금 상점에서 옷을 살 때 뼈다귀가 나가는 기록이다. 돈으로 뼈다귀를 산 기록은 `bone_pack`으로 따로 둔다. 실행 전에 지금 `type` 정의를 Workbench에서 확인하고, 기존 값은 그대로 둔 채 `bone_pack`만 더한다.

뼈다귀 팩은 `reference_id`에 스토어 거래 id를 넣는다. `bone_pack` 줄 중에 같은 거래 id가 있으면 지급하지 않는다. 웹훅 두 개가 동시에 오는 경우를 막으려고, 확인과 지급은 한 트랜잭션에서 한다.

`plus_expires_at`은 RevenueCat이 보내 준 만료 시각이다. UTC로 저장하고, 서버의 UTC 지금보다 뒤일 때만 Plus다. 폰 시간을 받아서 환산하지 않는다. 폰 시계는 틀릴 수 있고, 여행 중에도 구독 만료는 그 절대 시각에 끝난다. 화면에 “3월 3일에 갱신”을 보여줄 때만 폰의 지역 시간으로 바꾼다. Plus인지는 이 시각만 보고 정한다. 따로 상태 칸을 두면 시각과 어긋날 수 있다.

`POST /api/billing/revenuecat`이 웹훅을 받는다. 요청의 `Authorization`이 `REVENUECAT_WEBHOOK_SECRET`과 다르면 401이다. 그 유저가 우리 `users`에 없으면 200을 주고 아무것도 하지 않는다. RevenueCat은 200이 아니면 같은 이벤트를 다시 보낸다.

- 구독 시작, 갱신, 상품 변경: `plus_expires_at`, 상품 id, 스토어를 갱신하고 `plus_will_renew`를 1로 둔다.
- 취소: `plus_will_renew`만 0. 만료 시각 전까지는 Plus다.
- 만료: 받은 만료 시각을 그대로 둔다.
- 환불: `plus_expires_at`을 지금으로 바꿔서 바로 끈다.
- 뼈다귀 팩: 위 규칙대로 한 번만 `grantTokens`, 유형은 `bone_pack`.

`GET /api/billing/status`는 `{ plus, expiresAt, willRenew }`를 준다.

`GET /pets/:id/insights`는 구독이 없어도 카드용 `summary`는 준다. `data`의 사료 이름, 변, 가려움, 구토 숫자는 Plus일 때만 준다. 이 숫자를 앱에서만 숨기면 응답을 그대로 볼 수 있으므로 서버가 뺀다.

## 6. 인사이트 화면

인사이트 섹션을 가리지는 않는다. 요약 한 줄은 구독이 없어도 보이고, 사료 이름과 변·가려움·구토 숫자가 있는 상세만 막는다. 인사이트가 없으면 지금처럼 기록이 더 필요하다는 문구만 있고 결제 창은 없다.

홈의 사료 기록 밑에는 지금처럼 요약 한 줄이 보인다. 그 줄을 누르면 구독 시트가 뜬다. 거기에 `Subscribe to see details`라는 문구를 새로 넣지는 않는다.

Food history 화면의 인사이트 카드도 요약을 그대로 보여 준다. 카드 밑의 `Tap to see details`만 `Subscribe to see details`로 바뀐다. 카드를 눌러도 Insight Detail로 가지 않고 구독 시트가 뜬다. 버튼 금액은 스토어가 준 문자열이다. Restore purchases, Cancel이 있다.

Plus면 지금처럼 Insight Detail이 열린다. 그 화면 아래에 `Download for your vet`. 이 버튼은 결제 창이 아니다.

구독하거나 복원한 다음에는 인사이트를 다시 불러온다. 구독 전에 받은 응답에는 상세 숫자가 없다.

Insight Detail은 숫자가 없는 응답이 들어오면 열지 않는다. 그 화면은 지금 숫자가 있다고 보고 그리기 때문이다.

구독 시트에는 스토어 문자열 가격과 기간, 해지하기 전까지 자동 갱신된다는 문장, 이용약관과 개인정보 처리방침 링크가 있다. 애플 심사에 필요하다.

프로필에 PHD Plus 줄을 둔다. 구독 중이면 `Renews on {날짜}` 또는 취소한 뒤면 `Ends on {날짜}`. 그 줄에서 Manage subscription은 스토어의 구독 관리 화면을 연다. Restore purchases도 여기 있다. 계정을 지워도 스토어 구독은 끝나지 않으니, 계정 삭제 확인창에 그 문장을 넣는다.

## 7. PDF

상세에 이미 있는 내용만 폰에서 문서로 만든다.

- 펫 이름
- 만든 날짜
- 요약 문장
- 그 성분이 있는 사료와 없는 사료의 변, 가려움, 구토
- Food history에 있는 문장. 상관관계이지 원인이 아니고, 수의사와 상의하라는 뜻

제목은 수의사에게 보여줄 사료 요약이다. 만든 파일을 아이폰·안드로이드 공유 창으로 넘긴다. 분석을 다시 돌리지 않는다.

문서는 `expo-print`로 만든다. 지금 앱에 없는 패키지라서 설치하고 개발 빌드를 새로 만든다. 공유는 이미 있는 `expo-sharing`을 쓴다.

PDF를 만들 때 서버에서 숫자를 다시 받지 않는다. 화면에 있는 그 응답으로 만든다. 그 응답은 이미 Plus일 때만 숫자가 있다.

## 8. 뼈다귀

홈에서 뼈다귀 숫자를 누를 때, 그리고 캐릭터 상점에서 옷값이 모자랄 때 뜨는 버는 법 시트 아래에 팩 세 개를 둔다.

고르면 스토어 결제 창이 뜨고, 웹훅이 들어온 뒤에만 잔액이 늘어난다. 결제가 끝나면 잔액을 짧은 간격으로 몇 번 다시 읽는다. 늘어나면 `🦴×200` 토스트를 띄운다. 끝까지 안 늘면 `Your bones will appear shortly.`를 띄운다.

결제 창을 닫거나 취소하면 아무 메시지도 띄우지 않는다.

## 9. 순서

코드는 스토어 상품 없이 먼저 짤 수 있다. RevenueCat 키가 없으면 구독 시트와 뼈다귀 팩 버튼이 숨고, 나머지는 그대로 동작한다.

1. 마이그레이션 파일을 쓴다. 실행은 Workbench에서 직접 한다.
2. 웹훅, `GET /api/billing/status`, 인사이트 API의 Plus 체크를 붙인다.
3. 구독 시트, 상세 잠금, 프로필의 PHD Plus 줄, PDF, 뼈다귀 팩 버튼을 붙인다. 시트 금액은 스토어 문자열만 쓴다.
4. 애플 유료 앱 계약과 구글 결제 프로필을 끝낸다.
5. 실결제 상품 다섯 개와 최저가 테스트 상품 다섯 개를 양쪽 스토어에 만든다.
6. RevenueCat에 키를 올리고 `plus`, 오퍼링 `test`와 `live`, 패키지 다섯 개를 만든다. 웹훅 URL과 시크릿을 넣는다.
7. `EXPO_PUBLIC_BILLING_TIER=test`, `BILLING_ALLOW_SANDBOX=true`로 개발 빌드를 만든다.
8. 샌드박스와 라이선스 테스터로 구독, 취소, 복원, 만료, 환불, 뼈다귀 중복 지급이 없는지 본다. 이 구매는 실제 청구되지 않는다.
9. 출시 빌드는 `EXPO_PUBLIC_BILLING_TIER=live`, 서버는 `BILLING_ALLOW_SANDBOX=false`로 둔다.

## 10. 약관과 개인정보 처리방침 업데이트

파일 위치: `petfood-analyzer/backend/src/legal/terms.html`, `privacy.html`. 백엔드를 푸쉬하면 앱에서 여는 URL이 바로 바뀐다.

### Terms of Service에 추가

1. **PHD Plus 구독**
   - 가격과 기간은 결제 화면에 나오는 대로다. 결제는 Apple 또는 Google 계정으로 처리된다.
   - 해지하기 전까지 자동 갱신된다. 만료 24시간 전까지 스토어 구독 설정에서 해지해야 다음 결제가 안 된다.
   - 해지해도 이미 낸 기간 끝까지는 Plus가 유지된다.
   - 환불은 Apple 또는 Google 정책을 따른다. 우리가 직접 환불하지 않는다. 환불되면 Plus는 바로 꺼진다.
   - 가격이 바뀌면 스토어 규칙에 따라 미리 알린다.
   - **앱 계정을 지워도 스토어 구독은 끝나지 않는다.** 스토어 구독 설정에서 따로 해지해야 한다.
2. **뼈다귀 (가상 아이템)**
   - 현금 가치가 없고, 현금으로 바꾸거나 다른 사람에게 넘길 수 없다.
   - 앱 안 상점에서만 쓴다. 법이나 스토어 정책이 요구하는 경우 말고는 환불되지 않는다.
   - 계정을 지우면 남은 뼈다귀도 같이 없어진다.
   - 상점 아이템이나 가격은 바뀔 수 있다.
3. **수의사용 PDF**
   - 인사이트와 PDF는 기존 면책(정보 제공용, 수의사 진단 아님)에 포함된다.
   - PDF는 유저가 기록한 데이터를 요약한 것이지 의료 기록이 아니다.
4. **약관 변경 알림**
   - 중요한 변경은 앱 안에서 따로 알린다.

### Privacy Policy에서 바꿀 것

1. **결제 정보 추가**
   - 카드 번호는 우리가 받지 않는다. Apple 또는 Google이 처리한다.
   - 우리가 받는 것: 상품, 구매일, 만료일, 거래 id, 스토어 이름.
2. **서드파티 서비스 목록에 추가**
   - RevenueCat: 구매 기록과 구독 상태 관리.
   - Apple, Google: 결제 처리.
   - Resend: 분석 완료 이메일. (이미 쓰고 있지만 목록에 없음)
   - Expo push: 알림. (이미 쓰고 있지만 목록에 없음)
3. **틀린 문장 수정**
   - "We do not collect your email" → 분석 요청 시 이메일을 선택적으로 받고, 결과 알림에만 쓴다.
   - "No third-party SDKs" → RevenueCat SDK가 들어간다. 광고 추적은 하지 않는다.
   - 수집 항목에 데일리 기록(건강 로그)과 푸시 토큰 추가.
   - "Gemini에는 성분 텍스트만 간다" → 분석 요청 사진도 Gemini로 간다.
4. **삭제와 보관**
   - 법이 요구하는 거래 기록(세금, 회계)은 계정 삭제 후에도 보관할 수 있다.
5. **Last updated 날짜 변경**

### 스토어 설정

- App Store 개인정보 라벨에 Purchases 항목 추가.
- Google Play 데이터 보안 양식에 Purchase history 추가.
- 이게 정책 문서와 다르면 심사에서 걸릴 수 있다.
