// test/TokenStaking.test.ts
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TokenStaking, MockERC20 } from '../typechain-types';

describe('TokenStaking', function () {
    let staking: TokenStaking;
    let token: MockERC20;
    let owner: any;
    let staker: any;

    const stakeAmount = ethers.parseUnits('100', 18);
    const NFT = await ethers.getContractFactory("MockNFT");
    const nft = await NFT.deploy("TestNFT", "TNFT");

    beforeEach(async function () {
        [owner, staker] = await ethers.getSigners();

        // MockERC20 토큰 배포
        const Token = await ethers.getContractFactory('MockERC20');
        token = (await Token.deploy('MockToken', 'MTK')) as MockERC20;
        await token.waitForDeployment();

        // TokenStaking 컨트랙트 배포
        const Staking = await ethers.getContractFactory('TokenStaking');
        staking = (await Staking.deploy()) as TokenStaking;
        await staking.waitForDeployment();

        // *** 아래 추가??  rewardToken 설정  //
        // await staking.connect(owner).setRewardToken(await token.getAddress());

        // staker에게 토큰 전송
        await token.mint(staker.address, stakeAmount);
    });

    describe('stake()', function () {
        it('사용자가 토큰을 스테이킹할 수 있어야 합니다.', async function () {
            // user가 staking 컨트랙트에 토큰 사용 승인
            await token.connect(staker).approve(await staking.getAddress(), stakeAmount);

            // 스테이킹 실행
            await staking.connect(staker).stake(stakeAmount);

            // 스테이킹된 잔액 확인
            const staked = await staking.stakedBalance(staker.address);
            expect(staked).to.equal(stakeAmount);

            // staking 컨트랙트의 토큰 잔액 확인
            const contractBalance = await token.balanceOf(await staking.getAddress());
            expect(contractBalance).to.equal(stakeAmount);
        });
    });

    describe('unstake()', function () {
        it('사용자가 스테이킹한 토큰을 언스테이킹할 수 있어야 합니다.', async function () {
            // 스테이킹 준비
            await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
            await staking.connect(staker).stake(stakeAmount);

            // 3일 경과 시뮬레이션
            await ethers.provider.send('evm_increaseTime', [3 * 24 * 60 * 60]);
            await ethers.provider.send('evm_mine', []);

            // 언스테이킹 실행
            await staking.connect(staker).unstake(stakeAmount);

            // 스테이킹된 잔액이 0인지 확인
            const staked = await staking.stakedBalance(staker.address);
            expect(staked).to.equal(0);

            // user의 토큰 잔액이 원래대로 돌아왔는지 확인
            const userBalance = await token.balanceOf(staker.address);
            expect(userBalance).to.equal(stakeAmount);
        });

        it('스테이킹하지 않은 상태에서 언스테이킹 시도 시 실패해야 합니다.', async function () {
            await expect(staking.connect(staker).unstake(stakeAmount)).to.be.revertedWith('Not enough staked');
        });

        it('3일 전에 언스테이킹 시도 시 실패해야 합니다.', async function () {
            await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
            await staking.connect(staker).stake(stakeAmount);

            // 바로 언스테이킹 시도 (3일 안 지남)
            await expect(
                staking.connect(staker).unstake(stakeAmount)
            ).to.be.revertedWith('Need to stake for at leaset 3 days');
        });
    });

    describe('reward logic', function () {
        it('보상이 시간에 따라 누적되고 claim으로 수령할 수 있어야 함', async function () {
            await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
            await staking.connect(staker).stake(stakeAmount);

            // 1일 경과
            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine', []);

            const before = await token.balanceOf(staker.address);

            await staking.connect(staker).claimReward();

            const after = await token.balanceOf(staker.address);
            expect(after).to.be.gt(before); // 보상 수령했는지 확인
        });

        it('NFT를 가진 사용자는 보상이 2배로 지급되어야 함', async function () {
            // 가짜 NFT 컨트랙트 배포
            const NFT = await ethers.getContractFactory('MockNFT'); // ERC721 컨트랙트 필요
            const nft = await NFT.deploy('TestNFT', 'TNFT');
            await nft.waitForDeployment();

            // staker에게 NFT 발행
            await nft.mint(staker.address, 1);
            await staking.connect(owner).setRewardNFT(await nft.getAddress());

            await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
            await staking.connect(staker).stake(stakeAmount);

            // 1일 경과
            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine', []);

            const before = await token.balanceOf(staker.address);
            await staking.connect(staker).claimReward();
            const after = await token.balanceOf(staker.address);

            const reward = after - before;
            expect(reward).to.be.gt(ethers.parseUnits('0.0086', 18)); // 대략적인 기준치
        });

        it('여러 번 스테이킹해도 보상은 누적 계산되어야 함', async function () {
            await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
            await staking.connect(staker).stake(stakeAmount.div(2));

            // 1일 후 추가 스테이킹
            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine', []);

            await staking.connect(staker).stake(stakeAmount.div(2));

            // 다시 하루 후
            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine', []);

            await staking.connect(staker).claimReward();

            const reward = await token.balanceOf(staker.address);
            expect(reward).to.be.gt(0);
        });
    });
});
