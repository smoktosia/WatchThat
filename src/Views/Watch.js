import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import ky from 'ky'
import URL from 'url-parse'
import classnames from 'classnames'

// utils
import isURL from 'validator/lib/isURL'

// hooks
import useSocket from 'hooks/useSocket'
import useLocalisation from 'hooks/useLocalisation'
import useModal from 'hooks/useModal'
import useAuthModal from 'hooks/useAuthModal'
import useError from 'hooks/useError'
import useAuth from 'hooks/useAuth'

// UI components
import Player from 'components/organisms/Player/Player'
import TextInput from 'components/atoms/Input/Input'
import ChooseUsername from 'components/organisms/Modals/ChooseUsername'
import RoomControls from 'components/organisms/RoomControls/RoomControls'
import RoomMembers from 'components/organisms/RoomMembers/RoomMembers'

// style
import style from './Watch.module.scss'

const Watch = () => {
    const l = useLocalisation()

    const playerContainer = useRef(null),
        membersRef = useRef(null)

    const navigate = useNavigate(),
        params = useParams()

    const usernameModal = useModal(),
        [isAuthModalOpen] = useAuthModal()

    const auth = useAuth()

    const handleError = useError()

    const [video, setVideo] = useState({}),
        [currentRoom, setCurrentRoom] = useState(null),
        [search, setSearch] = useState('')

    const [containerWidth, setContainerWidth] = useState(800)

    const [members, setMembers] = useState(
        1 === 2 //eslint-disable-line
            ? [{ username: 'Sajmon', socketId: 'nwm', _id: null }]
            : []
    )

    const [socket, socketUserId, initSocket] = useSocket()

    const username = auth.user
        ? auth.user.username
        : localStorage.getItem('tempUsername')

    // handle unmount
    useEffect(() => {
        return () => {
            if (socket) socket.emit('room_leave')
        }
    }, [socket])

    // init socket
    useEffect(() => {
        if (
            !auth.checked ||
            (socket &&
                ((auth.user && socketUserId === auth.user._id) ||
                    (!auth.user && !socketUserId)))
        )
            return

        initSocket(auth)
    }, [socket, auth, socketUserId]) // eslint-disable-line

    // check for param and username
    useEffect(() => {
        if (!params.id) navigate('/')
        if (!username && !usernameModal.isOpen && !isAuthModalOpen) {
            usernameModal.handleOpenModal()
            if (currentRoom && currentRoom.length > 0) {
                setCurrentRoom(null)
                if (socket) socket.emit('room_leave')
            }
        }
    }, [params.id, username, usernameModal.isOpen, isAuthModalOpen]) // eslint-disable-line

    // join room
    useEffect(() => {
        if (currentRoom === params.id || !socket || !params.id || !username)
            return

        setCurrentRoom(params.id)

        socket.emit('room_join', { clearId: params.id, username })
    }, [currentRoom, params.id, username, socket])

    // socket handlers
    useEffect(() => {
        if (!socket) return

        // room actions
        socket.on('room_joined', () => {
            console.log('room_joined')
        })

        socket.on('room_not_joined', (reason) => {
            // TODO: handle unauthorized reason

            if (reason === 'username') {
                handleError({ err: 'invalidUsername' })
                localStorage.removeItem('tempUsername')
                usernameModal.handleOpenModal()
            }
        })

        socket.on('room_invalid', () => {
            handleError({ err: 'invalidRoom' })
            navigate('/')
        })

        socket.on('room_error', () => {
            console.log('room_error')
        })

        // users actions
        socket.on('user_joined', (params) => {
            const _members = Array.isArray(members) ? [...members] : []
            _members.push(params)

            setMembers(_members)
        })

        socket.on('user_leaved', (params) => {
            if (!members || !Array.isArray(members) || members.length < 1)
                return

            console.log(`${params.socketId} leaved from the room`, params)

            const userIndex = members.findIndex(({ socketId, _id }) => {
                if (params.socketId === socketId) return true
                if (_id && _id === params.socket_id) return true
                return false
            })

            console.log('userIndex', userIndex, members)

            if (userIndex >= 0) {
                const _members = [...members]
                _members.splice(userIndex, 1)
                setMembers(_members)
            }
        })

        socket.on('set_members_list', (params) => {
            // self set
            if (!username) return

            const _members = [...members] || []

            _members.push({
                self: true,
                username,
                socketId: socket.id,
                _id: auth.user ? auth.user._id : null,
            })

            if (params && Array.isArray(params) && params.length > 0) {
                params.forEach((user) => {
                    if (!user.socketId || !user.username) return

                    let found = false
                    if (_members.length > 0) {
                        _members.forEach(({ socketId }) => {
                            if (socketId === user.socketId) found = true
                        })
                    }

                    if (!found) _members.push(user)
                })
            }

            setMembers(_members)
        })

        // video actions
        socket.on('set video', ({ video, username }) => {
            console.log(`received new video from ${username}`)
            setVideo(video)
        })

        return () => {
            socket.off('room_invalid')
            socket.off('room_joined')
            socket.off('room_error')
            socket.off('user_joined')
        }
    }, [socket, members, username]) // eslint-disable-line

    useEffect(() => {
        if (!playerContainer.current) return

        const updateWidth = () => {
            setContainerWidth(playerContainer.current.offsetWidth)
        }

        const observer = new ResizeObserver(updateWidth).observe(
            playerContainer.current
        )

        return () => observer.disconnect()
    }, [playerContainer])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (isURL(search)) {
            try {
                // get video file from url
                const res = await ky
                    .get(
                        `/api/v1/video/extract?url=${encodeURIComponent(
                            search
                        )}`
                    )
                    .json()

                // if no url
                if (!res.url) throw Error('no_url')

                let _video = {}

                // video url
                _video.url = Array.isArray(res.url) ? res.url : [res.url]
                // can we use video url or iframe instead
                _video.indirect = res.indirect ? true : false

                if (res.title) _video.title = res.title

                _video.hostname = new URL(_video.url[0]).hostname

                setVideo(_video)

                if (socket) {
                    console.log('sendind video to room')
                    socket.emit('new video', _video)
                }
            } catch (err) {
                console.log(err)
            }
        } else {
            console.log('invalid url')
        }
    }

    return (
        <div className={classnames(style.Watch)}>
            <RoomControls containerWidth={containerWidth} />
            <div
                ref={playerContainer}
                className={style.container}
                style={{
                    '--width': containerWidth + 'px',
                }}
            >
                {!username && (
                    <ChooseUsername
                        isOpen={usernameModal.isOpen}
                        handleCloseModal={usernameModal.handleCloseModal}
                        cb={(...params) => {
                            console.log(...params)
                        }}
                    />
                )}

                <form onSubmit={handleSubmit} className={style.input}>
                    <TextInput
                        width="100%"
                        height="40px"
                        placeholder={l('typeVideoUrl')}
                        value={search}
                        onChange={({ target: { value } }) => setSearch(value)}
                    />
                </form>

                <div className={style.playerBox}>
                    <Player
                        video={video}
                        containerWidth={containerWidth}
                        socket={socket}
                    />
                </div>
            </div>
            <RoomMembers
                playerContainer={playerContainer}
                forwardRef={membersRef}
                members={members}
            />
        </div>
    )
}

export default Watch
