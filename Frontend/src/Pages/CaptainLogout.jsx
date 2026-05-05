
import React, { useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import {
    clearCaptainToken,
    getCaptainAuthHeaders,
    getCaptainToken
} from '../utils/authStorage'

export const CaptainLogout = () => {
    const token = getCaptainToken()
    const navigate = useNavigate()

    useEffect(() => {
        const logoutCaptain = async () => {
            try {
                if (token) {
                    await axios.get(`${import.meta.env.VITE_BASE_URL}/captains/logout`, {
                        headers: getCaptainAuthHeaders()
                    })
                }
            } catch (error) {
                console.error('Captain logout failed:', error)
            } finally {
                clearCaptainToken({ includeLegacy: true })
                navigate('/captain-login')
            }
        }

        logoutCaptain()
    }, [ navigate, token ])

    return (
        <div>CaptainLogout</div>
    )
}

export default CaptainLogout
