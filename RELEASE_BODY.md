* **feat: render markdown release notes in update modal and simplify button text** (`e6c4fd8`)
  - 릴리즈 노트를 단순 텍스트가 아닌 제목, 볼드, 코드 뱃지, 불릿 리스트가 정돈된 마크다운 뷰어로 렌더링하도록 개선
  - 업데이트 버튼 문구를 '지금 원클릭 업데이트'에서 '지금 업데이트'로 담백하게 변경

* **ci: escape variable substitution in release notes python script** (`16243d1`)
  - GitHub Actions 셸 스크립트 실행 시 python 코드 내의 문자열 치환 오류를 방지하기 위해 quoted EOF 블록 적용
  - 커밋 해시값과 상세 한국어 설명이 마크다운 릴리즈 노트에 완벽하게 렌더링되도록 보장

* **ci: format multiline Korean commit descriptions into release notes** (`de01775`)
  - GitHub Actions 릴리즈 노트 생성 시 커밋 제목뿐만 아니라 커밋 본문에 적힌 상세 한국어 작업 내역도 함께 파싱하여 등록하도록 개선
  - 영문 제목만 보고 파악하기 어렵던 릴리즈 내역을 상세한 한국어 불릿 포인트로 누구나 직관적으로 확인할 수 있도록 지원

