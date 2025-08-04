// "use client"

// import { useEffect, useState } from "react"
// import { toast } from "react-hot-toast"

// export default function NetworkRestriction({ children }: { children: React.ReactNode }) {
//   const [isAllowed, setIsAllowed] = useState<boolean | null>(null)

//   useEffect(() => {
//     const allowedIP = "84.54.122.28"

//     const checkAccess = async () => {
//       // Agar localhostda ishlayotgan bo‘lsa, ruxsat beramiz
//       if (
//         window.location.hostname === "localhost" ||
//         window.location.hostname === "127.0.0.1"
//       ) {
//         setIsAllowed(true)
//         return
//       }

//       try {
//         const res = await fetch("https://ipapi.co/json/")
//         const data = await res.json()

//         console.log("Foydalanuvchi IP:", data.ip)

//         if (data.ip === allowedIP) {
//           setIsAllowed(true)
//         } else {
//           toast.error("Faqat restoran Wi-Fi orqali kirish mumkin!")
//           setIsAllowed(false)
//           setTimeout(() => {
//             window.location.href = "https://abdiaxatov.uz"
//           }, 3000)
//         }
//       } catch (error) {
//         toast.error("Tarmoq aniqlanmadi. Faqat restoran Wi-Fi orqali kirish mumkin!")
//         setIsAllowed(false)
//         setTimeout(() => {
//           window.location.href = "https://abdiaxatov.uz"
//         }, 3000)
//       }
//     }

//     checkAccess()
//   }, [])

//   if (isAllowed === null) return null

//   if (!isAllowed) {
//     return (
//       <div className="w-screen h-screen flex flex-col items-center justify-center bg-white text-center px-4">
//         <div className="text-gray-800 text-lg font-medium mb-6">
//           Faqat restoran Wi-Fi orqali kirish mumkin! <br />
//           Iltimos, to‘g‘ri tarmoqqa ulanib qayta urinib ko‘ring.
//         </div>
//         <button
//           onClick={() => (window.location.href = "https://abdiaxatov.uz")}
//           className="bg-[#f9822c] text-white px-6 py-2 rounded-lg text-base font-semibold hover:opacity-90 transition"
//         >
//           Qaytish
//         </button>
//       </div>
//     )
//   }

//   return <>{children}</>
// }
