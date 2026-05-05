import React, { useContext, useEffect, useState } from 'react'
import { UserDataContext } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
    clearUserToken,
    getUserAuthHeaders,
    getUserToken,
    isLegacyToken,
    persistUserToken
} from '../utils/authStorage'

const UserProtectWrapper = ({
    children
}) => {
    const token = getUserToken()
    const navigate = useNavigate()
    const { user, setUser } = useContext(UserDataContext)
    const [ isLoading, setIsLoading ] = useState(true)

    useEffect(() => {
        if (!token) {
            navigate('/login')
            return
        }

        axios.get(`${import.meta.env.VITE_BASE_URL}/users/profile`, {
            headers: getUserAuthHeaders()
        }).then(response => {
            if (response.status === 200 && response.data?._id) {
                persistUserToken(token)
                setUser(response.data)
                setIsLoading(false)
                return
            }

            clearUserToken({ includeLegacy: isLegacyToken(token) })
            navigate('/login')
        })
            .catch(err => {
                const statusCode = err?.response?.status

                if (statusCode === 401 || statusCode === 403) {
                    clearUserToken({ includeLegacy: isLegacyToken(token) })
                    navigate('/login')
                    return
                }

                console.error('User session validation failed:', err)
                setIsLoading(false)
            })
    }, [ navigate, setUser, token ])

    if (isLoading) {
        return (
            <div>Loading...</div>
        )
    }

    return (
        <>
            {children}
        </>
    )
}

export default UserProtectWrapper
