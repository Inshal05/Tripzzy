import React, { useContext, useEffect, useState } from 'react'
import { CaptainDataContext } from '../context/CapatainContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
    clearCaptainToken,
    getCaptainAuthHeaders,
    getCaptainToken,
    isLegacyToken,
    persistCaptainToken
} from '../utils/authStorage'

const CaptainProtectWrapper = ({
    children
}) => {

    const token = getCaptainToken()
    const navigate = useNavigate()
    const { captain, setCaptain } = useContext(CaptainDataContext)
    const [ isLoading, setIsLoading ] = useState(true)




    useEffect(() => {
        if (!token) {
            navigate('/captain-login')
            return
        }

        axios.get(`${import.meta.env.VITE_BASE_URL}/captains/profile`, {
            headers: getCaptainAuthHeaders()
        }).then(response => {
            if (response.status === 200 && response.data?.captain?._id) {
                persistCaptainToken(token)
                setCaptain(response.data.captain)
                setIsLoading(false)
                return
            }

            clearCaptainToken({ includeLegacy: isLegacyToken(token) })
            navigate('/captain-login')
        })
            .catch(err => {
                const statusCode = err?.response?.status

                if (statusCode === 401 || statusCode === 403) {
                    clearCaptainToken({ includeLegacy: isLegacyToken(token) })
                    navigate('/captain-login')
                    return
                }

                console.error('Captain session validation failed:', err)
                setIsLoading(false)
            })
    }, [ navigate, setCaptain, token ])

    

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

export default CaptainProtectWrapper
