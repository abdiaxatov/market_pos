'use client'

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const ScanPage = () => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedResult, setScannedResult] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const qrRegionId = 'qr-reader';

    // Mobil qurilma aniqlash
    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            setIsMobile(isMobileDevice);
        };
        checkMobile();
    }, []);

    // Kamera ruxsatini so'rash
    const requestCameraPermission = async (): Promise<boolean> => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment'
                    } 
                });
                return true;
            }
            return false;
        } catch (err: any) {
            console.error('Kamera ruxsati xatoligi:', err);
            return false;
        }
    };

    const startScanner = useCallback(async () => {
        if (typeof window === 'undefined' || isScanning) return;

        try {
            setError('');
            setIsScanning(true);
            
            // Avvalgi skayner to'xtatish
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                } catch (err) {
                    console.log("Avvalgi skayner to'xtatildi");
                }
            }

            const scanner = new Html5Qrcode(qrRegionId);
            scannerRef.current = scanner;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                // Mobil uchun maxsus sozlamalar
                ...(isMobile && {
                    qrbox: { width: 200, height: 200 },
                    fps: 5,
                })
            };

            await scanner.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    console.log("QR kod o'qildi:", decodedText);
                    setScannedResult(decodedText);
                    setIsScanning(false);
                    
                    // Skayner to'xtatish
                    scanner.stop().catch((err) => {
                        console.error("To'xtatishda xatolik:", err);
                    });
                },
                (errorMessage: string) => {
                    // Faqat xatolikni log qilamiz
                    console.warn("Skayner xatoligi:", errorMessage);
                }
            );
        } catch (err: any) {
            console.error("Skayner boshlashda xatolik:", err);
            
            // Mobil uchun maxsus xatolik xabarlari
            if (isMobile) {
                if (err.name === 'NotAllowedError') {
                    setError('Kamera ruxsati berilmadi. Iltimos, brauzer sozlamalaridan kameraga ruxsat bering va sahifani yangilang.');
                } else if (err.name === 'NotFoundError') {
                    setError('Kamera topilmadi. Iltimos, qurilmangizda kamera borligini tekshiring.');
                } else if (err.name === 'NotSupportedError') {
                    setError('Bu brauzer kamera funksiyasini qo\'llab-quvvatlamaydi. Chrome yoki Safari ishlatib ko\'ring.');
                } else {
                    setError('Kamerani ochishda xatolik yuz berdi. Iltimos, kamera ruxsatini bering.');
                }
            } else {
                setError('Kamerani ochishda xatolik yuz berdi. Iltimos, kamera ruxsatini bering.');
            }
            
            setIsScanning(false);
        }
    }, [isScanning, isMobile]);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                setIsScanning(false);
                console.log("Skayner to'xtatildi");
            } catch (err) {
                console.error("To'xtatishda xatolik:", err);
            }
        }
    }, []);

    const resetScanner = useCallback(() => {
        setScannedResult('');
        setError('');
        if (!isScanning) {
            startScanner();
        }
    }, [isScanning, startScanner]);

    // Faqat bir marta ishga tushirish
    useEffect(() => {
        if (!isInitialized) {
            setIsInitialized(true);
            // Kichik kechikish bilan ishga tushirish
            const timer = setTimeout(() => {
                startScanner();
            }, 100);
            
            return () => clearTimeout(timer);
        }
    }, [isInitialized, startScanner]);

    // Component unmount bo'lganda tozalash
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch((err) => {
                    console.error("Tozalashdagi xatolik:", err);
                });
            }
        };
    }, []);

    return (
        <div className="p-6 max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-4 text-center">📷 QR Kod Skayneri</h1>
            
            {isMobile && (
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
                    <strong>📱 Mobil qurilma:</strong> Kamera ruxsatini bering
                </div>
            )}
            
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <strong>Xatolik:</strong> {error}
                </div>
            )}

            {scannedResult && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    <strong>Natija:</strong> {scannedResult}
                </div>
            )}

            <div className="mb-4">
                <div 
                    id={qrRegionId} 
                    className="w-full max-w-sm mx-auto border-2 border-gray-300 rounded-lg overflow-hidden"
                    style={{ minHeight: '300px' }}
                ></div>
            </div>

            <div className="flex gap-2 justify-center">
                {!isScanning && (
                    <button
                        onClick={startScanner}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Skayner boshlash
                    </button>
                )}
                
                {isScanning && (
                    <button
                        onClick={stopScanner}
                        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Skayner to'xtatish
                    </button>
                )}
                
                {scannedResult && (
                    <button
                        onClick={resetScanner}
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Yangi skan
                    </button>
                )}
            </div>

            <div className="mt-4 text-sm text-gray-600 text-center">
                <p>Kamera ruxsatini bering va QR kodni ko'rsating</p>
                {isMobile && (
                    <p className="mt-2 text-xs">
                        💡 Agar kamera ochilmasa, brauzer sozlamalaridan kamera ruxsatini tekshiring
                    </p>
                )}
            </div>
        </div>
    );
};

export default ScanPage;