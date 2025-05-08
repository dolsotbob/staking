# 🪙 ATT Staking Dapp

지갑 생성 + Faucet 기능이 있는 기존 블로그에 
스테이킹 기능 Dapp 추가 

## 📌 개요
- 사용자 흐름: ** 지갑 생성 → Faucet → 스테이킹 ** 
- 목표: 블로그에서 Web3 체험 제공 (유저가 직접 체험해볼 수 있도록)
- 토큰: KAIA (KAIA 테스트넷)

## 사용자 흐름 예시 
1. 지갑 생성  
2. Faucet에서 테스트 코인 받음 (예: 10 KAIA)  
3. 블로그에 연결된 스테이킹 DApp 접속  
4. [Stake 5 KAIA] 버튼 클릭 → 트랜잭션 승인  
5. 일정 시간 후 보상 발생 → 지갑에서 확인 가능  
6. [Unstake] 시 원금+보상을 다시 내 지갑으로 회수

## 📦 기능
- 스테이킹 및 보상 조회
- 특정 NFT 보유하면 보상 2배 

## 🛠️ 사용 기술
- Solidity (KAIA 테스트넷)
- React + TypeScript
- Hardhat

## 🧱 스마트 컨트랙트 설계

### ▶️ 주요 함수
- stake(uint256 amount)
- unstake()
- updateReward()

### 💡 아이디어
- 3일 이상 스테이킹 하면 1 초당  0.0001 token 보상 

### 앞으로 할 것들  
- test.ts 마저 하기 
- permit 을 상속받아 Gasless로 만들기 >> test.ts 수정 
- 컨트랙트 주소의 잔액이 없어질 경우 대비 (보상으로 줄 토큰이 없을까봐) 
- 기존 블로그와 합치기
