// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract TokenStaking is Ownable {
    // stakingToken과 rewardNFT를 각각 IERC20 및 IERC721 인터페이스 타입으로 선언
    IERC20 public stakingToken;
    IERC721 public rewardNFT;

    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 reward;
    }

    mapping(address => StakeInfo) public stakes;

    // Solidity는 소수점이 없어서 정수 대신 큰 단위로 곱해놓고 계산 후 나누는 방식을 씀
    uint256 public rewardRatePerSecond = 1e14; // 0.0001 token/sec per staked token

    // 컨트랙트가 배포될 때 스테이킹에 사용할 ERC20 토큰의 주소를 입력받는다
    constructor(address _stakingToken) Ownable(msg.sender) {
        // _stakingToken을 IERC20 인터페이스로 변환하여 stakingToken 변수에 할당
        stakingToken = IERC20(_stakingToken);
    }

    // 가스비 줄이기 위해 가시성은 public 대신 external 씀
    function stake(uint256 amount) external {
        require(amount > 0, "Cannot stake 0");

        // 보상 업데이트
        // 인자로 address user가 아닌 msg.sender를 쓰는 이유:
        // - address user를 쓰면 사용자의 주소로 인자로 받아 다른 사용자의 보상도 업데이트 할 수 있기 때문
        // - msg.sender를 써야 현재 함수를 호출한 사용자만 보상을 업데이트 한다
        _updateReward(msg.sender);

        // 사용자 토큰 전송
        // ** 사용자가 approve 먼저 해야 함
        // (+) 나중에 permit으로 바꾸기
        stakingToken.transferFrom(msg.sender, address(this), amount);
        // 상태 업데이트
        stakes[msg.sender].amount += amount;
        // *** timestamp를 매번 덮어쓰는 것은 누적형 스테이킹에서 문제될 수 있음
        stakes[msg.sender].timestamp = block.timestamp;
    }

    function unstake(uint256 amount) external {
        require(amount > 0, "Cannot unstake 0");
        require(stakes[msg.sender].amount >= amount, "Not enough staked");
        require(
            block.timestamp - stakes[msg.sender].timestamp >= 3 days,
            "Need to stake for at least 3 days"
        );

        _updateReward(msg.sender);

        // 상태 변경 -> 외부 호출 순서가 Solidity 보안 관례임 (stake 함수에서는 자금을 받는 쪽이고, 리앤트런시 위험이 적어서 반대 순서도 괜찮음)
        stakes[msg.sender].amount -= amount;
        stakingToken.transfer(msg.sender, amount);
    }

    // 현재까지 누적되니 보상만 수령
    function claimReward() external {
        _updateReward(msg.sender);

        uint256 reward = stakes[msg.sender].reward;
        require(reward > 0, "No reward");

        stakes[msg.sender].reward = 0;
        stakingToken.transfer(msg.sender, reward);
    }

    // NFT로 보상을 2배 주는 컨트랙트 주소 등록
    function setRewardNFT(address _nftAddress) external onlyOwner {
        rewardNFT = IERC721(_nftAddress);
    }

    function _updateReward(address user) internal {
        StakeInfo storage userStake = stakes[user];
        if (userStake.amount > 0) {
            uint256 timeElapsed = block.timestamp - userStake.timestamp;

            uint256 rate = rewardRatePerSecond;

            // NFT를 가지고 있으면 보상 2배
            if (
                address(rewardNFT) != address(0) &&
                // rewardNFT>balancOf(user)는 사용자가 소유한 해당 NFT 개수
                rewardNFT.balanceOf(user) > 0
            ) {
                rate *= 2;
            }

            // 이더리움 표준 토큰이 18 decimals이기 때문에 1e18로 나눔; 1e18 == 1000000000000000000
            uint256 reward = (userStake.amount * rate * timeElapsed) / 1e18;
            userStake.reward += reward;
        }
        userStake.timestamp = block.timestamp;
    }

    function setRewardRate(uint256 _rate) external onlyOwner {
        rewardRatePerSecond = _rate;
    }
}
