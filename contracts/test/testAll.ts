import { expect } from "chai";
import { ethers } from "hardhat";

// ✅ 移除对 parseEther/toBigInt 的解构！直接使用 ethers.utils.parseEther

// Helper: Create a fixture loader that resets on each test or describe block
function createFixtureLoader<T>(fixture: () => Promise<T>) {
    return async (): Promise<T> => {
        return await fixture(); // ✅ 每次都重新执行，避免缓存
    };
}

describe("EasyBet - Decentralized Lottery System", function () {
    async function deploy() {
        const [owner, player1, player2, player3] = await ethers.getSigners();

        const EasyBet = await ethers.getContractFactory("EasyBet");
        const easyBet = await EasyBet.deploy();

        return { easyBet, owner, player1, player2, player3 };
    }

    // ✅ 每个 describe 使用自己的 fixture，避免状态污染
    describe("Contract Deployment", function () {
        it("Should deploy successfully and return 'hello world'", async function () {
            const { easyBet } = await deploy(); // ✅ 直接 deploy，不缓存
            expect(await easyBet.helloworld()).to.equal("hello world");
        });
    });

    describe("Activity Creation", function () {
        it("Should allow owner to create a new activity", async function () {
            const { easyBet, owner } = await deploy();
            const description = "Will ETH reach $4000 by 2025?";
            const choices = ["Yes", "No"];
            const durationHours = 24;

            await expect(easyBet.createActivity(description, choices, durationHours))
                .to.emit(easyBet, "ActivityCreated")
                .withArgs(0, owner.address, description, choices);

            const activity = await easyBet.activities(0);
            const activityInfo = await easyBet.getActivityInfo(0);
            expect(activity.description).to.equal(description);
            expect(activityInfo.choices).to.deep.equal(choices);

            const latestBlock = await ethers.provider.getBlock("latest");
            const expectedEndTime = BigInt(latestBlock!.timestamp) + BigInt(durationHours * 3600);
            expect(activity.endTime).to.equal(expectedEndTime);
        });

        it("Should revert when creating activity with less than 2 choices", async function () {
            const { easyBet } = await deploy();
            await expect(
                easyBet.createActivity("Test", ["Yes"], 24)
            ).to.be.revertedWith("At least two choices required");
        });
    });

    describe("Ticket Purchase", function () {
        it("Should allow players to buy tickets for valid choices", async function () {
            const { easyBet, player1, player2 } = await deploy();

            await easyBet.createActivity("Is BTC bullish?", ["Yes", "No"], 24);

            // Player 1 buys ticket for "Yes"
            await expect(
                easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") })
            )
                .to.emit(easyBet, "BetPlaced")
                .withArgs(
                    0,
                    ethers.utils.parseEther("0.01"),
                    player1.address,
                    0,
                    0
                );

            // Player 2 buys ticket for "No"
            await expect(
                easyBet.connect(player2).buyTicket(0, 1, { value: ethers.utils.parseEther("0.02") })
            )
                .to.emit(easyBet, "BetPlaced")
                .withArgs(
                    1,
                    ethers.utils.parseEther("0.02"),
                    player2.address,
                    0,
                    1
                );

            //const activity = await easyBet.activities(0);
            const activity = await easyBet.getActivityInfo(0);
            expect(activity.prizePool).to.equal(ethers.utils.parseEther("0.03"));
            expect(activity.choiceAmounts[0]).to.equal(ethers.utils.parseEther("0.01"));
            expect(activity.choiceAmounts[1]).to.equal(ethers.utils.parseEther("0.02"));

            expect(await easyBet.ownerOf(0)).to.equal(player1.address);
            expect(await easyBet.ownerOf(1)).to.equal(player2.address);
        });

        it("Should revert when buying ticket for non-existent activity", async function () {
            const { easyBet, player1 } = await deploy();
            await expect(
                easyBet.connect(player1).buyTicket(999, 0, { value: ethers.utils.parseEther("0.01") })
            ).to.be.revertedWith("Activity does not exist");
        });

        it("Should revert when choice index is invalid", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("Test", ["Yes", "No"], 24);
            await expect(
                easyBet.connect(player1).buyTicket(0, 2, { value: ethers.utils.parseEther("0.01") })
            ).to.be.revertedWith("Invalid choice index");
        });

        it("Should revert when bet amount is zero", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("Test", ["Yes", "No"], 24);
            await expect(
                easyBet.connect(player1).buyTicket(0, 0, { value: 0 })
            ).to.be.revertedWith("Bet amount must be greater than zero");
        });

        it("Should revert when activity has ended", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("Test", ["Yes", "No"], 0); // ✅ duration 0 表示立即结束
            await expect(
                easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") })
            ).to.be.revertedWith("Activity has ended");
        });
    });

    describe("Ticket Transfer (Trading)", function () {
        it("Should allow transfer of tickets between players", async function () {
            const { easyBet, player1, player2 } = await deploy();

            await easyBet.createActivity("Trade Test", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            await expect(() =>
                easyBet.connect(player1).transferFrom(player1.address, player2.address, tokenId)
            ).to.changeTokenBalances(easyBet, [player1, player2], [-1, 1]);

            expect(await easyBet.ownerOf(tokenId)).to.equal(player2.address);
        });
    });

    describe("Activity Resolution", function () {
        it("Should allow owner to resolve activity with valid winning choice", async function () {
            const { easyBet } = await deploy();
            await easyBet.createActivity("Winner!", ["A", "B"], 24); // 24小时

            // ⏩ 快进24小时
            await ethers.provider.send("evm_increaseTime", [24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            await expect(easyBet.resolveActivity(0, 1))
                .to.emit(easyBet, "ActivityResolved")
                .withArgs(0, 1);

            const activity = await easyBet.activities(0);
            expect(activity.isResolved).to.be.true;
            expect(activity.winningChoiceIndex).to.equal(1);
        });

        it("Should revert when resolving already resolved activity", async function () {
            const { easyBet } = await deploy();
            await easyBet.createActivity("Test", ["A", "B"], 24);

            // ⏩ 快进时间
            await ethers.provider.send("evm_increaseTime", [24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            await easyBet.resolveActivity(0, 0);

            await expect(easyBet.resolveActivity(0, 1))
                .to.be.revertedWith("Activity already resolved");
        });
    });
    // describe("Prize Claiming", function () {
    //     it("Should allow winners to claim proportional prize", async function () {
    //         const { easyBet, player1, player2 } = await deploy();

    //         await easyBet.createActivity("Winning Pool", ["Win", "Lose"], 24);

    //         // player1 买 tokenId = 0
    //         await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

    //         // player2 买 tokenId = 1
    //         await easyBet.connect(player2).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

    //         // 结算：choice 0 赢
    //         await easyBet.resolveActivity(0, 0);

    //         // 各自领取自己的奖
    //         await expect(() => easyBet.connect(player1).claimPrize(0))
    //             .to.changeEtherBalance(player1, ethers.utils.parseEther("0.01"));

    //         await expect(() => easyBet.connect(player2).claimPrize(1))
    //             .to.changeEtherBalance(player2, ethers.utils.parseEther("0.01"));

    //         // 验证事件
    //         await expect(easyBet.connect(player1).claimPrize(0))
    //             .to.emit(easyBet, "PrizeClaimed")
    //             .withArgs(0, player1.address, ethers.utils.parseEther("0.01"));
    //     });

    //     it("Should revert if claiming from non-existent activity", async function () {
    //         const { easyBet, player1 } = await deploy();
    //         await expect(easyBet.connect(player1).claimPrize(999)).to.be.revertedWith("Activity does not exist");
    //     });

    //     it("Should revert if activity is not resolved", async function () {
    //         const { easyBet, player1 } = await deploy();
    //         await easyBet.createActivity("Unresolved", ["A", "B"], 24);
    //         await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });
    //         await expect(easyBet.connect(player1).claimPrize(0)).to.be.revertedWith("Activity not resolved yet");
    //     });

    //     it("Should revert if player has no winning tickets", async function () {
    //         const { easyBet, player1, player2 } = await deploy();
    //         await easyBet.createActivity("Win/Lose", ["Win", "Lose"], 24);
    //         await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });
    //         await easyBet.resolveActivity(0, 0);
    //         await expect(easyBet.connect(player2).claimPrize(0)).to.be.revertedWith("No winning tickets for this player");
    //     });

    //     // it("Should prevent double claiming", async function () {
    //     //     const { easyBet, player1 } = await deploy();
    //     //     await easyBet.createActivity("No Double Claim", ["Win", "Lose"], 24);
    //     //     await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });
    //     //     await easyBet.resolveActivity(0, 0);

    //     //     await easyBet.connect(player1).claimPrize(0);
    //     //     await expect(easyBet.connect(player1).claimPrize(0)).to.be.revertedWith("No winning tickets for this player");
    //     // });
    // });
    describe("Prize Claiming", function () {
        it("Should allow winners to claim proportional prize", async function () {
            const { easyBet, player1, player2 } = await deploy();

            await easyBet.createActivity("Winning Pool", ["Win", "Lose"], 24);

            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });
            await easyBet.connect(player2).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            // ⏩ 快进时间
            await ethers.provider.send("evm_increaseTime", [24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            // 结算
            await easyBet.resolveActivity(0, 0);

            // 各自领取奖
            await expect(() => easyBet.connect(player1).claimPrize(0))
                .to.changeEtherBalance(player1, ethers.utils.parseEther("0.01"));

            await expect(() => easyBet.connect(player2).claimPrize(0))
                .to.changeEtherBalance(player2, ethers.utils.parseEther("0.01"));

            // 验证事件
            await expect(easyBet.connect(player1).claimPrize(0))
                .to.be.revertedWith("No winning tickets or already claimed"); // 现在应该 revert
        });

        it("Should revert if activity is not resolved", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("Unresolved", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            // ⚠️ 时间未到，不能 resolve，但 claim 会检查 resolved 状态
            await expect(easyBet.connect(player1).claimPrize(0))
                .to.be.revertedWith("Activity not resolved"); // 注意：这里必须和 Solidity 一致！
        });

        it("Should revert if player has no winning tickets", async function () {
            const { easyBet, player1, player2 } = await deploy();
            await easyBet.createActivity("Win/Lose", ["Win", "Lose"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            // ⏩ 快进 + resolve
            await ethers.provider.send("evm_increaseTime", [24 * 3600]);
            await ethers.provider.send("evm_mine", []);
            await easyBet.resolveActivity(0, 0); // Win 是 choice 0

            // player2 没买 winning ticket
            await expect(easyBet.connect(player2).claimPrize(0))
                .to.be.revertedWith("No winning tickets or already claimed");
        });
    });
    describe("Token Information", function () {
        it("Should return correct token info", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("BTC Price", ["Up", "Down"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            const info = await easyBet.getTokenInfo(tokenId);
            expect(info.activityId).to.equal(0);
            expect(info.choiceIndex).to.equal(0);
            expect(info.activityDescription).to.equal("BTC Price");
            expect(info.choiceName).to.equal("Up");
        });
    });

    describe("Activity Info", function () {
        it("Should return full activity info", async function () {
            const { easyBet } = await deploy();
            await easyBet.createActivity("Full Info", ["A", "B"], 24);
            const activity = await easyBet.getActivityInfo(0);
            expect(activity.description).to.equal("Full Info");
            expect(activity.choices).to.deep.equal(["A", "B"]);
            expect(activity.prizePool).to.equal(0);
        });
    });
    describe("Ticket Listing and Trading", function () {
        it("Should allow owner to list a ticket for sale", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("List Test", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            const price = ethers.utils.parseEther("0.02");
            await expect(easyBet.connect(player1).listTicket(tokenId, price))
                .to.emit(easyBet, "TicketListed")
                .withArgs(tokenId, price);

            const listing = await easyBet.listings(tokenId);
            expect(listing.seller).to.equal(player1.address);
            expect(listing.price).to.equal(price);
            expect(listing.active).to.be.true;
        });

        it("Should revert when listing a ticket not owned", async function () {
            const { easyBet, player1, player2 } = await deploy();
            await easyBet.createActivity("List Test", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            const price = ethers.utils.parseEther("0.02");
            await expect(easyBet.connect(player2).listTicket(tokenId, price))
                .to.be.revertedWith("Not owner");
        });

        it("Should revert when listing a resolved ticket", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("List Test", ["A", "B"], 1);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            // ⏩ fast forward and resolve
            await ethers.provider.send("evm_increaseTime", [7200]);
            await ethers.provider.send("evm_mine", []);
            await easyBet.resolveActivity(0, 0);

            const tokenId = 0;
            const price = ethers.utils.parseEther("0.02");
            await expect(easyBet.connect(player1).listTicket(tokenId, price))
                .to.be.revertedWith("Activity already resolved");
        });

        it("Should allow buyer to purchase a listed ticket", async function () {
            const { easyBet, player1, player2 } = await deploy();
            await easyBet.createActivity("Buy Listed", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            const price = ethers.utils.parseEther("0.03");
            await easyBet.connect(player1).listTicket(tokenId, price);

            const negativePrice = price.mul(-1);

            // ✅ 一次调用，同时检查事件和余额变化
            await expect(easyBet.connect(player2).buyListedTicket(tokenId, { value: price }))
                .to.emit(easyBet, "TicketSold")
                .withArgs(tokenId, player1.address, player2.address, price)
                .and.to.changeEtherBalances([player1, player2], [price, negativePrice]);

            expect(await easyBet.ownerOf(tokenId)).to.equal(player2.address);

            const listing = await easyBet.listings(tokenId);
            expect(listing.active).to.be.false;
        });

        it("Should revert when buying with incorrect price", async function () {
            const { easyBet, player1, player2 } = await deploy();
            await easyBet.createActivity("Buy Listed", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            const price = ethers.utils.parseEther("0.03");
            await easyBet.connect(player1).listTicket(tokenId, price);

            await expect(
                easyBet.connect(player2).buyListedTicket(tokenId, { value: ethers.utils.parseEther("0.02") })
            ).to.be.revertedWith("Incorrect price");
        });

        it("Should revert when buying inactive or unlisted ticket", async function () {
            const { easyBet, player1, player2 } = await deploy();
            await easyBet.createActivity("Buy Listed", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            await expect(
                easyBet.connect(player2).buyListedTicket(tokenId, { value: ethers.utils.parseEther("0.01") })
            ).to.be.revertedWith("Not listed or inactive");
        });

        it("Should allow seller to cancel listing", async function () {
            const { easyBet, player1 } = await deploy();
            await easyBet.createActivity("Cancel Test", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            const price = ethers.utils.parseEther("0.02");
            await easyBet.connect(player1).listTicket(tokenId, price);

            await expect(easyBet.connect(player1).cancelListing(tokenId))
                .to.emit(easyBet, "ListingCancelled")
                .withArgs(tokenId);

            const listing = await easyBet.listings(tokenId);
            expect(listing.active).to.be.false;
        });

        it("Should revert when cancelling someone else's listing", async function () {
            const { easyBet, player1, player2 } = await deploy();
            await easyBet.createActivity("Cancel Test", ["A", "B"], 24);
            await easyBet.connect(player1).buyTicket(0, 0, { value: ethers.utils.parseEther("0.01") });

            const tokenId = 0;
            const price = ethers.utils.parseEther("0.02");
            await easyBet.connect(player1).listTicket(tokenId, price);

            await expect(easyBet.connect(player2).cancelListing(tokenId))
                .to.be.revertedWith("Not seller");
        });
    });
});