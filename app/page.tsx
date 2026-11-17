'use client'
import React,{useEffect} from 'react'
import { useRouter } from 'next/navigation'
const HomePage = () => {

  const router = useRouter()

  useEffect(() => {
    router.push('/icons')
  }, [router])

  return (
    <div>9hv' ,u vy wi zbf rqkf 9i' wso...</div>
  )
}

export default HomePage