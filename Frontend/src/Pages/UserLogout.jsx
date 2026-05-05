import React, { useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { clearUserToken, getUserAuthHeaders, getUserToken } from '../utils/authStorage'

export const UserLogout = () => {

    const token = getUserToken()
    const navigate = useNavigate()

    useEffect(() => {
        const logoutUser = async () => {
            try {
                if (token) {
                    await axios.get(`${import.meta.env.VITE_BASE_URL}/users/logout`, {
                        headers: getUserAuthHeaders()
                    })
                }
            } catch (error) {
                console.error('User logout failed:', error)
            } finally {
                clearUserToken({ includeLegacy: true })
                navigate('/login')
            }
        }

        logoutUser()
    }, [ navigate, token ])

    return (
        <div>UserLogout</div>
    )
}

export default UserLogout
