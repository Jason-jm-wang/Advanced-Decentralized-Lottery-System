// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useEasyBet } from './hooks/useEasyBet';

// 定义视图类型
type View = 'account' | 'create' | 'buy' | 'my-tickets' | 'resolve';

function App() {
  // 从自定义 Hook 获取合约和钱包连接状态
  const { contract, signer, error } = useEasyBet();

  // 状态管理
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0.0');
  const [contractConnected, setContractConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<View>('account'); // 默认显示账户信息
  const [owner, setOwner] = useState<string | null>(null);
  // 初始化逻辑（获取账户地址、余额等）
  useEffect(() => {
    const initAccountAndBalance = async () => {
      console.log('🔍 开始初始化：signer =', signer, 'contract =', contract);
      const _owner = await contract?.owner();
      setOwner(_owner);
      console.log('👑 合约所有者地址:', _owner);
      if (!signer || !contract) {
        console.log('⚠️ signer 或 contract 为空，跳过初始化');
        setLoading(false);
        return;
      }

      try {
        const addr = await signer.getAddress();
        console.log('✅ 获取到账户地址:', addr);
        setAccount(addr);

        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        const network = await provider.getNetwork();
        console.log('🌐 当前连接的网络:', network);

        const bal = await provider.getBalance(addr);
        const balanceInEth = ethers.utils.formatEther(bal);
        console.log('💰 账户余额（wei）:', bal.toString());
        console.log('💰 账户余额（ETH）:', balanceInEth);
        setBalance(balanceInEth);

        // 测试合约调用
        console.log('🧪 尝试调用 contract.activityCount()...');
        try {
          const count = await contract.activityCount();
          console.log('✅ activityCount() 返回:', count.toString());
          setContractConnected(true);
        } catch (e: any) {
          console.error('❌ contract.activityCount() 失败:', e.message || e);
          setContractConnected(false);
        }
      } catch (err: any) {
        console.error('💥 初始化过程出错:', err);
      } finally {
        setLoading(false);
      }
    };

    initAccountAndBalance();
  }, [signer, contract]);

  // 渲染不同页面的内容
  const renderContent = () => {
    switch (currentView) {
      case 'create':
        return <CreateProject
          contract={contract}
          account={account}
          owner={owner}
        />;
      case 'buy':
        return <BuyTicket
          contract={contract}
          account={account}
        />;
      case 'my-tickets':
        return <MyTickets
          contract={contract}
          account={account}
        />;
      case 'account':
        return <AccountInfo />;
      case 'resolve':
        return <ResolveActivity
          contract={contract}
          account={account}
          owner={owner}
        />;
      default:
        return <div>Unknown</div>;

    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>⏳ 正在连接钱包...</div>;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', padding: '20px' }}>🎲 去中心化竞猜彩票系统</h1>

      {error && <p style={{ color: 'red', textAlign: 'center' }}>❌ {error}</p>}

      {/* 主布局：左侧导航 + 右侧内容 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: '20px',
        padding: '0 20px 20px'
      }}>
        {/* 左侧导航栏 */}
        <nav style={{
          background: '#f0f0f0',
          borderRadius: '8px',
          padding: '15px'
        }}>
          <button onClick={() => setCurrentView('account')} style={buttonStyle}>
            我的账户
          </button>
          <button onClick={() => setCurrentView('create')} style={buttonStyle}>
            创建项目
          </button>
          <button onClick={() => setCurrentView('buy')} style={buttonStyle}>
            购买彩票
          </button>
          <button onClick={() => setCurrentView('my-tickets')} style={buttonStyle}>
            你的彩票
          </button>
          {account === owner && (
            <button onClick={() => setCurrentView('resolve')} style={buttonStyle}>
              开奖
            </button>
          )}
        </nav>

        {/* 右侧主内容区 */}
        <section style={{
          background: '#fafafa',
          borderRadius: '8px',
          padding: '20px',
          minHeight: '400px'
        }}>
          {/* 显示账户信息（顶部小卡片） */}
          {account && (
            <div style={{
              background: '#e6f7e6',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <p><strong>账户:</strong> {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}</p>
              <p><strong>余额:</strong> {parseFloat(balance).toFixed(4)} ETH</p>
              <p><strong>合约状态:</strong>
                <span style={{ color: contractConnected ? 'green' : 'red' }}>
                  {contractConnected ? '✅ 已连接' : '❌ 未连接'}
                </span>
              </p>
            </div>
          )}

          {/* 渲染当前页面内容 */}
          {renderContent()}
        </section>
      </div>
    </div>
  );
}

// 按钮样式（简化版）
const buttonStyle = {
  display: 'block',
  width: '100%',
  padding: '10px',
  margin: '8px 0',
  fontSize: '16px',
  background: '#ddd',
  color: 'black',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

// 子组件占位（后续填充）
function AccountInfo() {
  return <div>请通过MetaMask切换账户</div>;
}

interface CreateProjectProps {
  contract: ethers.Contract | null;
  account: string;
  owner: string | null;
}

function CreateProject({ contract, account, owner }: CreateProjectProps) {
  const [description, setDescription] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  // 直接使用 App 中的 account 和 owner（闭包）
  const isOwner = account && owner && account.toLowerCase() === owner.toLowerCase();

  const addChoice = () => {
    setChoices([...choices, '']);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 2) {
      const newChoices = [...choices];
      newChoices.splice(index, 1);
      setChoices(newChoices);
    }
  };

  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !isOwner) return;

    const validChoices = choices.filter(c => c.trim() !== '');
    if (validChoices.length < 2) {
      setMessage('❌ 至少需要两个非空选项');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const tx = await contract.createActivity(description.trim(), validChoices, durationHours);
      const receipt = await tx.wait();

      let activityId = 'unknown';
      if (receipt.events) {
        for (const ev of receipt.events) {
          if (ev.event === 'ActivityCreated') {
            activityId = ev.args?.activityId?.toString() || 'unknown';
            break;
          }
        }
      }

      setMessage(`✅ 项目创建成功！活动 ID: ${activityId}`);
      setDescription('');
      setChoices(['', '']);
      setDurationHours(24);
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ 创建失败: ${err.reason || err.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <div>
        <h2>🚫 权限不足</h2>
        <p>只有合约所有者可以创建竞猜项目。</p>
        <p><strong>当前账户:</strong> {account ? `${account.substring(0, 6)}...${account.slice(-4)}` : '未连接'}</p>
        <p><strong>合约所有者:</strong> {owner ? `${owner.substring(0, 6)}...${owner.slice(-4)}` : '加载中...'}</p>
      </div>
    );
  }

  return (
    <div>
      <h2>🎯 创建竞猜项目</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label><strong>活动描述</strong></label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：NBA总决赛冠军"
            required
            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <strong>选项列表（至少两项）</strong>
          {choices.map((choice, index) => (
            <div key={index} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                value={choice}
                onChange={(e) => updateChoice(index, e.target.value)}
                placeholder={`选项 ${index + 1}`}
                style={{ flex: 1, padding: '8px' }}
              />
              {choices.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeChoice(index)}
                  style={{ padding: '8px', background: '#ffe6e6', border: '1px solid #ff6666', borderRadius: '4px' }}
                >
                  ❌
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addChoice}
            style={{ marginTop: '8px', padding: '6px 12px', background: '#e6f7ff', border: '1px solid #91d5ff' }}
          >
            添加选项
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label><strong>持续时间（小时）</strong></label>
          <input
            type="number"
            min="1"
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: loading ? '#ccc' : '#52c41a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '创建中...' : '创建项目'}
        </button>

        {message && (
          <div style={{ marginTop: '16px', color: message.startsWith('✅') ? 'green' : 'red' }}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}

interface BuyTicketProps {
  contract: ethers.Contract | null;
  account: string;
}

function BuyTicket({ contract, account }: BuyTicketProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [buying, setBuying] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [betAmount, setBetAmount] = useState<string>('0.01'); // 默认 0.01 ETH


  const [view, setView] = useState<'activities' | 'listed'>('activities'); // 控制 Tab
  const [listedTickets, setListedTickets] = useState<any[]>([]);         // 挂单彩票列表
  const [loadingListed, setLoadingListed] = useState<boolean>(false);    // 挂单加载状态
  const [selectedListedTicket, setSelectedListedTicket] = useState<any>(null);

  // 加载所有活动
  useEffect(() => {
    const loadActivities = async () => {
      if (!contract) return;
      try {
        const count = await contract.activityCount();
        const list = [];
        for (let i = 0; i < count.toNumber(); i++) {
          try {
            const [
              owner,
              listedTimestamp,
              description,
              choices,
              choiceAmounts,
              prizePool,
              endTime,
              isResolved,
              winningChoiceIndex,
              isActive,
            ] = await contract.getActivityInfo(i);

            // 转换 choiceAmounts 为 ETH 数组（用于显示）
            const choiceAmountsInEth = choiceAmounts.map((amt: ethers.BigNumber) =>
              parseFloat(ethers.utils.formatEther(amt)).toFixed(4)
            );

            list.push({
              id: i,
              description,
              choices,
              choiceAmounts: choiceAmountsInEth,
              endTime: Number(endTime) * 1000, // 转为毫秒
              isActive,
              isResolved,
            });
          } catch (e) {
            console.warn(`Failed to load activity ${i}`, e);
          }
        }
        setActivities(list);
      } catch (err) {
        console.error('Failed to load activities', err);
        setMessage('❌ 加载项目失败');
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, [contract]);

  useEffect(() => {
    const loadListedTickets = async () => {
      if (!contract || !account) {
        console.warn("⚠️ contract or account not ready");
        setLoadingListed(false);
        return;
      }
      setLoadingListed(true);
      try {
        const listed: any[] = [];
        console.log("🔍 开始正确枚举所有挂单（使用两层循环）...");

        // ✅ Step 1: 获取活动总数
        const activityCount = await contract.activityCount();
        console.log(`📊 总活动数: ${activityCount.toString()}`);

        // ✅ Step 2: 遍历每个活动
        for (let activityId = 0; activityId < activityCount.toNumber(); activityId++) {
          console.log(`\n📌 处理活动 #${activityId}...`);

          // ✅ Step 3: 获取该活动生成的彩票数量
          const localCount = await contract.activityTicketCount(activityId);
          console.log(`   🎟️ 活动 ${activityId} 生成了 ${localCount.toString()} 张票`);

          // ✅ Step 4: 遍历该活动的每张彩票
          for (let localId = 0; localId < localCount.toNumber(); localId++) {
            // ✅ Step 5: 计算正确tokenId (使用BigInt处理大数)
            const tokenIdBigInt = (BigInt(activityId) << 64n) | BigInt(localId);
            const tokenId = ethers.BigNumber.from(tokenIdBigInt);

            console.log(`   🔍 检查票号: ${tokenId.toString()} (活动${activityId}, 本地ID${localId})`);

            try {
              // ✅ Step 6: 检查是否挂单
              const listing = await contract.listings(tokenId);
              if (!listing.active) {
                console.log(`   ❌ 票 ${tokenId} 未挂单`);
                continue;
              }

              // ✅ Step 7: 获取票信息
              const [activityId, choiceIndex, desc, choiceName] = await contract.getTokenInfo(tokenId);
              const activityInfo = await contract.getActivityInfo(activityId);
              const isResolved = activityInfo[7];

              if (isResolved) {
                console.log(`   ⏳ 活动已开奖，跳过票 ${tokenId}`);
                continue;
              }

              // ✅ Step 8: 收集有效挂单
              listed.push({
                tokenId: tokenId.toString(), // 用字符串存储，避免精度丢失
                price: ethers.utils.formatEther(listing.price),
                activityId: activityId.toString(),
                description: desc,
                choiceName,
                choiceIndex: choiceIndex.toNumber(),
              });
              console.log(`   ✅ 有效挂单: ${tokenId} (价格: ${listing.price})`);
            } catch (e) {
              console.warn(`   ⚠️ 票 ${tokenId} 加载失败:`, String(e));
            }
          }
        }

        console.log("📊 最终加载到的挂单数量:", listed.length);
        console.log("📋 挂单详情:", listed);
        setListedTickets(listed);
      } catch (err) {
        console.error('💥 loadListedTickets 全局错误:', err);
        setMessage('❌ 加载挂单失败: ' + String(err));
      } finally {
        setLoadingListed(false);
      }
    };

    if (view === 'listed') {
      loadListedTickets();
    }
  }, [contract, account, view]);
  const viewDetails = (activity: any) => {
    setSelectedActivity(activity);
    setBetAmount('0.01'); // 重置投注金额
    setMessage('');
  };

  const goBackToList = () => {
    setSelectedActivity(null);
    setMessage('');
  };

  const handleBuy = async (choiceIndex: number) => {
    if (!contract || !account) {
      setMessage('⚠️ 请先连接钱包');
      return;
    }
    if (!selectedActivity?.isActive || Date.now() > selectedActivity.endTime) {
      setMessage('❌ 该项目已结束或不可用，无法购买');
      return;
    }
    if (!/^\d*\.?\d+$/.test(betAmount) || parseFloat(betAmount) <= 0) {
      setMessage('⚠️ 请输入有效的投注金额（> 0 ETH）');
      return;
    }

    setBuying(true);
    setMessage('');

    try {
      const amountInWei = ethers.utils.parseEther(betAmount);
      const tx = await contract.buyTicket(selectedActivity.id, choiceIndex, {
        value: amountInWei,
      });
      await tx.wait();
      setMessage(`✅ 购买成功！已投注 ${betAmount} ETH 到选项 ${choiceIndex + 1}`);
      setBetAmount('0.01'); // 重置
    } catch (err: any) {
      console.error(err);
      const msg = err.reason || err.message || '未知错误';
      setMessage(`❌ 购买失败: ${msg.includes('Activity has ended') ? '活动已结束' : msg}`);
    } finally {
      setBuying(false);
    }
  };

  if (selectedActivity) {
    const now = Date.now();
    const isEnded = now > selectedActivity.endTime;
    const canBuy = selectedActivity.isActive && !isEnded;

    return (
      <div>

        <button onClick={goBackToList} style={{ marginBottom: '16px', padding: '6px 12px' }}>
          ← 返回项目列表
        </button>
        <h2>🎯 {selectedActivity.description}</h2>
        <p>
          <strong>状态:</strong>{' '}
          {canBuy ? (
            <span style={{ color: 'green' }}>🟢 进行中</span>
          ) : (
            <span style={{ color: 'red' }}>🔴 已结束</span>
          )}
        </p>
        <p><strong>投注金额 (ETH):</strong></p>
        <input
          type="number"
          step="0.001"
          min="0.001"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          disabled={!canBuy || buying}
          style={{
            padding: '8px',
            fontSize: '16px',
            width: '120px',
            marginRight: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
        <p><strong>选项列表:</strong></p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {selectedActivity.choices.map((choice: string, idx: number) => (
            <li
              key={idx}
              style={{
                marginBottom: '12px',
                padding: '12px',
                background: '#f9f9f9',
                borderRadius: '6px',
                border: '1px solid #eee',
              }}
            >
              <div>
                <strong>{idx + 1}. {choice}</strong>
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                💰 当前总投注: {selectedActivity.choiceAmounts[idx]} ETH
              </div>
              <button
                onClick={() => handleBuy(idx)}
                disabled={!canBuy || buying}
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: canBuy ? '#1890ff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: canBuy && !buying ? 'pointer' : 'not-allowed',
                }}
              >
                {buying ? '购买中...' : '🎟️ 购买'}
              </button>
            </li>
          ))}
        </ul>
        {message && (
          <div
            style={{
              marginTop: '16px',
              padding: '10px',
              borderRadius: '4px',
              backgroundColor: message.includes('✅') ? '#e6ffe6' : '#ffe6e6',
              color: message.includes('✅') ? 'green' : 'red',
            }}
          >
            {message}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div>⏳ 正在加载竞猜项目...</div>;
  }
  const canBuy =
    selectedActivity &&
    selectedActivity.isActive &&
    Date.now() < selectedActivity.endTime;
  return (
    <div>
      {/* 🔹 Tab 切换按钮 */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setView('activities')}
          style={{
            padding: '8px 16px',
            background: view === 'activities' ? '#1890ff' : '#f0f0f0',
            color: view === 'activities' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          参与竞猜
        </button>
        <button
          onClick={() => setView('listed')}
          style={{
            padding: '8px 16px',
            background: view === 'listed' ? '#1890ff' : '#f0f0f0',
            color: view === 'listed' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          购买挂单彩票
        </button>
      </div>

      {/* 🔹 活动详情页 */}
      {selectedActivity && (
        <div>
          <button onClick={goBackToList} style={{ marginBottom: '16px', padding: '6px 12px' }}>
            ← 返回项目列表
          </button>
          <h2>🎯 {selectedActivity.description}</h2>
          <p>
            <strong>状态:</strong>{' '}
            {canBuy ? (
              <span style={{ color: 'green' }}>🟢 进行中</span>
            ) : (
              <span style={{ color: 'red' }}>🔴 已结束</span>
            )}
          </p>
          <p><strong>投注金额 (ETH):</strong></p>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={!canBuy || buying}
            style={{
              padding: '8px',
              fontSize: '16px',
              width: '120px',
              marginRight: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
          <p><strong>选项列表:</strong></p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {selectedActivity.choices.map((choice: string, idx: number) => (
              <li
                key={idx}
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: '#f9f9f9',
                  borderRadius: '6px',
                  border: '1px solid #eee',
                }}
              >
                <div>
                  <strong>{idx + 1}. {choice}</strong>
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                  💰 当前总投注: {selectedActivity.choiceAmounts[idx]} ETH
                </div>
                <button
                  onClick={() => handleBuy(idx)}
                  disabled={!canBuy || buying}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: canBuy ? '#1890ff' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canBuy && !buying ? 'pointer' : 'not-allowed',
                  }}
                >
                  {buying ? '购买中...' : '🎟️ 购买'}
                </button>
              </li>
            ))}
          </ul>
          {message && (
            <div
              style={{
                marginTop: '16px',
                padding: '10px',
                borderRadius: '4px',
                backgroundColor: message.includes('✅') ? '#e6ffe6' : '#ffe6e6',
                color: message.includes('✅') ? 'green' : 'red',
              }}
            >
              {message}
            </div>
          )}
        </div>
      )}

      {/* 🔹 挂单票详情页 */}
      {selectedListedTicket && (
        <div>
          <button
            onClick={() => setSelectedListedTicket(null)}
            style={{ marginBottom: '16px', padding: '6px 12px' }}
          >
            ← 返回挂单列表
          </button>
          <h2>🎫 彩票 #{selectedListedTicket.tokenId}</h2>
          <p><strong>项目:</strong> {selectedListedTicket.description}</p>
          <p><strong>选项:</strong> {selectedListedTicket.choiceName}</p>
          <p><strong>价格:</strong> <span style={{ color: 'green', fontSize: '18px' }}>{selectedListedTicket.price} ETH</span></p>

          <button
            onClick={async () => {
              if (!contract || !account) {
                setMessage('⚠️ 请先连接钱包');
                return;
              }
              setBuying(true);
              setMessage('');
              try {
                const priceWei = ethers.utils.parseEther(selectedListedTicket.price);
                const tx = await contract.buyListedTicket(selectedListedTicket.tokenId, { value: priceWei });
                await tx.wait();
                setMessage(`✅ 购买成功！彩票 #${selectedListedTicket.tokenId} 已转入你的钱包`);
                setSelectedListedTicket(null);
              } catch (err: any) {
                console.error(err);
                const msg = err.reason || err.message || '未知错误';
                setMessage(`❌ 购买失败: ${msg}`);
              } finally {
                setBuying(false);
              }
            }}
            disabled={buying}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: buying ? '#ccc' : '#52c41a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: buying ? 'not-allowed' : 'pointer',
              fontSize: '16px',
            }}
          >
            {buying ? '购买中...' : `🎟️ 花 ${selectedListedTicket.price} ETH 购买`}
          </button>

          {message && (
            <div
              style={{
                marginTop: '16px',
                padding: '10px',
                borderRadius: '4px',
                backgroundColor: message.includes('✅') ? '#e6ffe6' : '#ffe6e6',
                color: message.includes('✅') ? 'green' : 'red',
              }}
            >
              {message}
            </div>
          )}
        </div>
      )}

      {/* 🔹 活动列表页 */}
      {!selectedActivity && !selectedListedTicket && view === 'activities' && (
        <div>
          {loading ? (
            <div>⏳ 正在加载竞猜项目...</div>
          ) : (
            <>
              <h2>🎫 可参与的竞猜项目</h2>
              {message && <div style={{ color: 'red', marginBottom: '16px' }}>{message}</div>}
              {activities.length === 0 ? (
                <p>暂无竞猜项目，快去创建一个吧！</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {activities.map((act) => {
                    const isEnded = Date.now() > act.endTime;
                    const isActive = act.isActive && !isEnded;
                    return (
                      <div
                        key={act.id}
                        onClick={() => viewDetails(act)}
                        style={{
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          padding: '16px',
                          cursor: 'pointer',
                          background: '#fff',
                          transition: 'box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                      >
                        <h3 style={{ margin: '0 0 8px 0' }}>#{act.id} {act.description}</h3>
                        <p style={{ fontSize: '14px', color: isActive ? 'green' : 'red' }}>
                          {isActive ? '🟢 进行中' : '🔴 已结束'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 🔹 挂单票列表页 */}
      {!selectedActivity && !selectedListedTicket && view === 'listed' && (
        <div>
          {loadingListed ? (
            <div>⏳ 正在加载挂单...</div>
          ) : (
            <>
              <h2>🏷️ 可购买的挂单彩票</h2>
              {message && <div style={{ color: 'red', marginBottom: '16px' }}>{message}</div>}
              {listedTickets.length === 0 ? (
                <p>暂无挂单彩票</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {listedTickets.map((ticket) => (
                    <div
                      key={ticket.tokenId}
                      onClick={() => setSelectedListedTicket(ticket)}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '16px',
                        cursor: 'pointer',
                        background: '#fff',
                        transition: 'box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      <h3 style={{ margin: '0 0 8px 0' }}>🎫 彩票 #{ticket.tokenId}</h3>
                      <p><strong>项目:</strong> {ticket.description}</p>
                      <p><strong>选项:</strong> {ticket.choiceName}</p>
                      <p><strong>价格:</strong> <span style={{ color: 'green' }}>{ticket.price} ETH</span></p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface MyTicketsProps {
  contract: ethers.Contract | null;
  account: string;
}

function MyTickets({ contract, account }: MyTicketsProps) {
  const [tickets, setTickets] = useState<Array<{
    tokenId: string;
    activityId: string;
    choiceIndex: number;
    activityDescription: string;
    choiceName: string;
    betAmount: string; // formatted ETH string
    isClaimed: boolean;
    canClaim: boolean;
    isResolved: boolean;
  }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>('');

  const [listingPrice, setListingPrice] = useState<Record<string, string>>({}); // tokenId -> price
  const [listing, setListing] = useState<Record<string, boolean>>({}); // tokenId -> isListing
  const [listings, setListings] = useState<Record<string, { price: string; active: boolean }>>({}); // 缓存 listing 状态

  useEffect(() => {
    const fetchMyTickets = async () => {
      if (!contract || !account) {
        setLoading(false);
        return;
      }

      try {
        const balance = await contract.balanceOf(account);
        const ticketList = [];

        for (let i = 0; i < balance.toNumber(); i++) {
          const tokenId = await contract.tokenOfOwnerByIndex(account, i);
          const tokenStr = tokenId.toString();

          const [activityId, choiceIndex, desc, choiceName] = await contract.getTokenInfo(tokenId);
          const betAmountWei = await contract.tokenBetAmount(tokenId);
          const isClaimed = await contract.ticketClaimed(tokenId);
          const activityInfo = await contract.getActivityInfo(activityId);

          const isResolved = activityInfo[7]; // isResolved
          const winningChoiceIndex = activityInfo[8].toNumber();
          const canClaim = isResolved && choiceIndex.toNumber() === winningChoiceIndex && !isClaimed;

          const listingInfo = await contract.listings(tokenId);
          const listingPriceEth = ethers.utils.formatEther(listingInfo.price);
          const isActive = listingInfo.active;

          setListings(prev => ({ ...prev, [tokenStr]: { price: listingPriceEth, active: isActive } }));

          ticketList.push({
            tokenId: tokenStr,
            activityId: activityId.toString(),
            choiceIndex: choiceIndex.toNumber(),
            activityDescription: desc,
            choiceName,
            betAmount: ethers.utils.formatEther(betAmountWei),
            isClaimed,
            canClaim,
            isResolved,
          });
        }

        setTickets(ticketList);
      } catch (err) {
        console.error('❌ 获取我的彩票失败:', err);
        setMessage('❌ 加载彩票失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    fetchMyTickets();
  }, [contract, account]);

  const handleClaim = async (activityId: string) => {
    if (!contract || !account) {
      setMessage('⚠️ 请先连接钱包');
      return;
    }

    setClaiming(prev => ({ ...prev, [activityId]: true }));
    setMessage('');

    try {
      const tx = await contract.claimPrize(activityId);
      await tx.wait();
      setMessage(`✅ 活动 #${activityId} 奖金领取成功！`);

      // 更新本地状态：标记为已领取
      setTickets(prev =>
        prev.map(t =>
          t.activityId === activityId ? { ...t, isClaimed: true, canClaim: false } : t
        )
      );
    } catch (err: any) {
      console.error('领取失败:', err);
      let errMsg = err.reason || err.message || '未知错误';
      if (errMsg.includes('No winning tickets')) {
        errMsg = '没有可领取的中奖彩票';
      } else if (errMsg.includes('Failed to send prize')) {
        errMsg = '发送奖金失败';
      }
      setMessage(`❌ 领取失败: ${errMsg}`);
    } finally {
      setClaiming(prev => ({ ...prev, [activityId]: false }));
    }
  };

  const handleListTicket = async (tokenId: string, price: string) => {
    if (!contract) return;
    if (!/^\d*\.?\d+$/.test(price) || parseFloat(price) <= 0) {
      setMessage('⚠️ 请输入有效价格（> 0 ETH）');
      return;
    }
    setListing(prev => ({ ...prev, [tokenId]: true }));
    try {
      const priceWei = ethers.utils.parseEther(price);
      const tx = await contract.listTicket(tokenId, priceWei);
      await tx.wait();
      setListings(prev => ({ ...prev, [tokenId]: { price, active: true } }));
      setMessage(`✅ 彩票 #${tokenId} 已挂单，售价 ${price} ETH`);
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ 挂单失败: ${err.reason || err.message}`);
    } finally {
      setListing(prev => ({ ...prev, [tokenId]: false }));
    }
  };

  const handleCancelListing = async (tokenId: string) => {
    if (!contract) return;
    setListing(prev => ({ ...prev, [tokenId]: true }));
    try {
      const tx = await contract.cancelListing(tokenId);
      await tx.wait();
      setListings(prev => ({ ...prev, [tokenId]: { ...prev[tokenId], active: false } }));
      setMessage(`✅ 已取消彩票 #${tokenId} 的挂单`);
    } catch (err: any) {
      setMessage(`❌ 取消失败: ${err.reason || err.message}`);
    } finally {
      setListing(prev => ({ ...prev, [tokenId]: false }));
    }
  };

  if (loading) {
    return <div>⏳ 正在加载你的彩票...</div>;
  }

  if (tickets.length === 0) {
    return (
      <div>
        <h2>🎟️ 你的彩票</h2>
        <p>你还没有购买任何彩票。</p>
        <p>前往「参与竞猜」购买一张试试吧！</p>
      </div>
    );
  }

  return (
    <div>
      <h2>🎟️ 你的彩票 ({tickets.length} 张)</h2>

      {message && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: message.startsWith('✅') ? '#e6ffe6' : '#ffe6e6',
            color: message.startsWith('✅') ? 'green' : 'red',
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {tickets.map((ticket) => (
          <div
            key={ticket.tokenId}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              background: ticket.canClaim ? '#f0fff0' : '#fafafa',
            }}
          >
            <p><strong>彩票 ID:</strong> #{ticket.tokenId}</p>
            <p><strong>活动 ID:</strong> #{ticket.activityId}</p>
            <p><strong>活动描述:</strong> {ticket.activityDescription}</p>
            <p><strong>选择:</strong> {ticket.choiceName} （选项 {ticket.choiceIndex + 1}）</p>
            <p><strong>投注金额:</strong> {ticket.betAmount} ETH</p>
            <p>
              <strong>状态:</strong>{' '}
              {ticket.isClaimed ? (
                <span style={{ color: 'green' }}>✅ 已领取奖金</span>
              ) : ticket.canClaim ? (
                <span style={{ color: 'green' }}>🎉 可领取奖金！</span>
              ) : ticket.isResolved ? (
                <span style={{ color: 'red' }}>❌ 已开奖，未中奖</span>
              ) : (
                <span style={{ color: '#888' }}>⏳ 等待开奖</span>
              )}
            </p>

            {ticket.canClaim && (
              <button
                onClick={() => handleClaim(ticket.activityId)}
                disabled={claiming[ticket.activityId]}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: claiming[ticket.activityId] ? '#ccc' : '#52c41a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: claiming[ticket.activityId] ? 'not-allowed' : 'pointer',
                }}
              >
                {claiming[ticket.activityId] ? '领取中...' : '领取奖金'}
              </button>
            )}
            {listings[ticket.tokenId]?.active ? (
              <div style={{ marginTop: '12px' }}>
                <p><strong>挂单价格:</strong> {listings[ticket.tokenId].price} ETH</p>
                <button
                  onClick={() => handleCancelListing(ticket.tokenId)}
                  disabled={listing[ticket.tokenId]}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: listing[ticket.tokenId] ? '#ccc' : '#ff4d4f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: listing[ticket.tokenId] ? 'not-allowed' : 'pointer',
                  }}
                >
                  {listing[ticket.tokenId] ? '取消中...' : '❌ 取消挂单'}
                </button>
              </div>
            ) : !ticket.isResolved ? (
              <div style={{ marginTop: '12px' }}>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="售价 (ETH)"
                  value={listingPrice[ticket.tokenId] || ''}
                  onChange={(e) => setListingPrice(prev => ({ ...prev, [ticket.tokenId]: e.target.value }))}
                  style={{ width: '100px', padding: '4px', marginRight: '8px' }}
                />
                <button
                  onClick={() => handleListTicket(ticket.tokenId, listingPrice[ticket.tokenId] || '0.01')}
                  disabled={listing[ticket.tokenId]}
                  style={{
                    padding: '4px 8px',
                    background: listing[ticket.tokenId] ? '#ccc' : '#1890ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: listing[ticket.tokenId] ? 'not-allowed' : 'pointer',
                  }}
                >
                  {listing[ticket.tokenId] ? '挂单中...' : '🏷️ 挂单出售'}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
interface ResolveActivityProps {
  contract: ethers.Contract | null;
  account: string;
  owner: string | null;
}

function ResolveActivity({ contract, account, owner }: ResolveActivityProps) {
  const [unresolvedActivities, setUnresolvedActivities] = useState<Array<{
    id: number;
    description: string;
    choices: { index: number; name: string }[];
  }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWinningChoice, setSelectedWinningChoice] = useState<Record<number, number>>({});
  const [resolving, setResolving] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState<string>('');

  // 只有 owner 才能加载，但组件本身不控制显示（由父级控制）
  useEffect(() => {
    const loadUnresolved = async () => {
      if (!contract || account !== owner) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage('');
      try {
        const count = Number(await contract.activityCount());
        const list = [];
        for (let i = 0; i < count; i++) {
          const info = await contract.getActivityInfo(i);
          const isResolved = info.isResolved;
          if (!isResolved) {
            list.push({
              id: i,
              description: info.description,
              choices: info.choices.map((c: string, idx: number) => ({
                index: idx,
                name: c,
              })),
            });
          }
        }
        setUnresolvedActivities(list);
      } catch (err) {
        console.error('❌ 加载可开奖活动失败:', err);
        setMessage('❌ 加载失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    loadUnresolved();
  }, [contract, account, owner]);

  const handleResolve = async (activityId: number) => {
    if (!contract || selectedWinningChoice[activityId] === undefined) return;

    setResolving(prev => ({ ...prev, [activityId]: true }));
    setMessage('');

    try {
      const tx = await contract.resolveActivity(activityId, selectedWinningChoice[activityId]);
      await tx.wait();
      setMessage(`✅ 活动 #${activityId} 开奖成功！`);

      // 从列表中移除已开奖项
      setUnresolvedActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (err: any) {
      console.error('开奖失败:', err);
      let errMsg = err.reason || err.message || '未知错误';
      if (errMsg.includes('Ownable: caller is not the owner')) {
        errMsg = '只有合约拥有者可以开奖';
      }
      setMessage(`❌ 开奖失败: ${errMsg}`);
    } finally {
      setResolving(prev => ({ ...prev, [activityId]: false }));
    }
  };

  if (loading) {
    return <div>⏳ 正在加载可开奖项目...</div>;
  }

  if (unresolvedActivities.length === 0) {
    return (
      <div>
        <h2>开奖管理</h2>
        <p>✅ 暂无可开奖的活动。</p>
      </div>
    );
  }

  return (
    <div>
      <h2>开奖管理（仅合约拥有者）</h2>

      {message && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: message.startsWith('✅') ? '#e6ffe6' : '#ffe6e6',
            color: message.startsWith('✅') ? 'green' : 'red',
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {unresolvedActivities.map((act) => (
          <div
            key={act.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              background: '#fafafa',
            }}
          >
            <p><strong>活动 ID:</strong> #{act.id}</p>
            <p><strong>描述:</strong> {act.description}</p>
            <div style={{ marginTop: '12px' }}>
              <label><strong>获胜选项：</strong></label>
              <select
                value={selectedWinningChoice[act.id] ?? ''}
                onChange={(e) =>
                  setSelectedWinningChoice({
                    ...selectedWinningChoice,
                    [act.id]: Number(e.target.value),
                  })
                }
                style={{ marginLeft: '10px', padding: '6px', borderRadius: '4px' }}
              >
                <option value="">-- 请选择 --</option>
                {act.choices.map((choice) => (
                  <option key={choice.index} value={choice.index}>
                    {choice.index + 1}: {choice.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleResolve(act.id)}
                disabled={
                  resolving[act.id] ||
                  selectedWinningChoice[act.id] === undefined ||
                  selectedWinningChoice[act.id] === null
                }
                style={{
                  marginLeft: '12px',
                  padding: '6px 12px',
                  backgroundColor: resolving[act.id] ? '#ccc' : '#52c41a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {resolving[act.id] ? '开奖中...' : '立即开奖'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default App;