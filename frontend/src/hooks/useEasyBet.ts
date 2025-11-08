// frontend/src/hooks/useEasyBet.ts
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import EasyBetArtifact from '../abi/EasyBet.json';
import addresses from '../contracts/addresses'; // 注意：没有 .ts 后缀！

export const useEasyBet = () => {
    const [contract, setContract] = useState<ethers.Contract | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            // 👇 关键修改：用 (window as any) 绕过 TypeScript 类型检查
            const ethereum = (window as any).ethereum;

            if (ethereum) {
                try {
                    const provider = new ethers.providers.Web3Provider(ethereum);
                    // 请求用户授权连接钱包
                    await provider.send("eth_requestAccounts", []);
                    const _signer = provider.getSigner();
                    const _contract = new ethers.Contract(
                        addresses.EasyBet,
                        EasyBetArtifact.abi,
                        _signer
                    );
                    setSigner(_signer);
                    setContract(_contract);
                    setError(null);
                } catch (err: any) {
                    setError(err.message || 'Failed to connect wallet');
                }
            } else {
                setError('Please install MetaMask!');
            }
        };

        init();
    }, []);

    return { contract, signer, error };
};