import React, { useState, useEffect } from 'react';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  Button,
  Tabs,
  Tab,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Avatar,
  Input,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTheme } from '@heroui/use-theme';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { RoomList } from '../components/RoomList';
import { SavedRoomList } from '../components/SavedRoomList';
import { 
  socket, 
  joinRoom, 
  leaveRoom, 
  getRoomById, 
  clientId, 
  getRoomMemberCount,
  onRoomMemberChange,
  reconnectSocket
} from '../utils/socket';
import { Room, RoomMemberEvent } from '../utils/types';
import { saveRoom, removeRoom, isRoomSaved, getSavedRooms } from '../utils/storage';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { IoMdPersonAdd, IoMdRemove } from 'react-icons/io';

// 随机名字库 - 分为中文和英文两类，使用形容词+名词可爱组合
const CN_ADJECTIVES = ['可爱', '萌萌', '温柔', '活泼', '聪明', '快乐', '甜蜜', '淘气', '软软', '闪亮', '乖巧', '迷你'];
const CN_NOUNS = ['小猫', '小熊', '小兔', '小鹿', '小狐', '小鸭', '小狗', '小象', '小猪', '小鸟', '花朵', '星星', '气球'];

const EN_ADJECTIVES = ['Fluffy', 'Tiny', 'Sweet', 'Bubbly', 'Cuddly', 'Sparkly', 'Happy', 'Cozy', 'Rosy', 'Playful'];
const EN_NOUNS = ['Bunny', 'Kitten', 'Puppy', 'Panda', 'Cookie', 'Muffin', 'Star', 'Fox', 'Duckling', 'Unicorn', 'Whale'];

// 生成随机名字 - 根据i18n语言设置决定生成中文还是英文名字
const generateRandomName = (language: string): string => {
  // 如果语言设置为中文，或者开头为zh（如zh-CN），则生成中文名字
  if (language === 'zh' || language.startsWith('zh-')) {
    const adj = CN_ADJECTIVES[Math.floor(Math.random() * CN_ADJECTIVES.length)];
    const noun = CN_NOUNS[Math.floor(Math.random() * CN_NOUNS.length)];
    return adj + noun;
  } else {
    // 否则生成英文名字
    const adj = EN_ADJECTIVES[Math.floor(Math.random() * EN_ADJECTIVES.length)];
    const noun = EN_NOUNS[Math.floor(Math.random() * EN_NOUNS.length)];
    return adj + noun;
  }
};

// 从名字获取显示字符（首字母或首汉字）
const getAvatarText = (name: string): string => {
  if (!name) return '?';
  // 检查是否是汉字（Unicode范围）
  const firstChar = name.charAt(0);
  if (/[\u4e00-\u9fa5]/.test(firstChar)) {
    return firstChar;
  }
  // 英文则返回大写首字母
  return firstChar.toUpperCase();
};

// 从用户名生成固定颜色
const getAvatarColor = (name: string): string => {
  if (!name) return 'primary';
  // 简单哈希算法，根据名字生成固定颜色
  const colors = ['primary', 'secondary', 'success', 'warning', 'danger'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// 保存用户名到本地存储
const saveUsername = (name: string) => {
  localStorage.setItem('message-system_username', name);
  return name;
};

// 从本地存储获取用户名
const getStoredUsername = (): string => {
  return localStorage.getItem('message-system_username') || '';
};

export const MessagePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  // 状态简化：不再单独存储 roomId 和 joined 状态
  const [rooms, setRooms] = useState<Room[]>([]);
  const [savedRooms, setSavedRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [view, setView] = useState<'chat' | 'rooms' | 'saved' | 'settings'>('rooms');
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  // 当 URL 参数包含房间时，先保存待确认的房间信息
  const [roomToJoin, setRoomToJoin] = useState<{ id: string; name: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // 添加房间成员数量状态
  const [memberCount, setMemberCount] = useState<number>(0);
  // 添加最近加入/离开消息状态
  const [memberEvent, setMemberEvent] = useState<{ type: 'join' | 'leave', userId: string } | null>(null);
  // 添加用户名状态
  const [username, setUsername] = useState<string>('');
  // 是否显示修改用户名弹窗
  const [showEditUsername, setShowEditUsername] = useState<boolean>(false);

  // 修改处：同时获取 setSearchParams 方法
  const [searchParams, setSearchParams] = useSearchParams();

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  // 修改处：使用 setSearchParams 更新 URL 参数
  const clearRoomUrlParam = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('room');
    setSearchParams(newParams);
  };

  // 初次加载时加载已保存房间和用户名
  useEffect(() => {
    setSavedRooms(getSavedRooms());
    
    // 加载或生成用户名
    let storedName = getStoredUsername();
    if (!storedName) {
      // 使用当前i18n语言设置生成随机名字
      storedName = saveUsername(generateRandomName(i18n.language));
    }
    setUsername(storedName);
  }, [i18n.language]);

  // 用户名变更时通知socket服务
  useEffect(() => {
    if (username) {
      socket.emit('set_username', username);
    }
  }, [username]);

  // 当组件加载或 URL 参数变化时，如果 URL 包含 room 参数，则先加载房间信息并要求确认
  useEffect(() => {
    const roomIdFromUrl = searchParams.get('room');
    if (roomIdFromUrl && !currentRoom) {
      setIsLoadingRoom(true);
      getRoomById(roomIdFromUrl)
        .then(roomInfo => {
          setIsLoadingRoom(false);
          if (roomInfo) {
            // 始终要求用户确认后进入房间
            setRoomToJoin({ id: roomIdFromUrl, name: roomInfo.name });
          } else {
            setError(t('errorRoomNotFound', { roomId: roomIdFromUrl }));
          }
        })
        .catch(() => {
          setIsLoadingRoom(false);
          setError(t('errorLoading'));
        });
    }
  }, [searchParams, currentRoom, t]);

  // 监听服务器返回的房间列表和新增房间
  useEffect(() => {
    socket.on('room_list', (roomList: Room[]) => setRooms(roomList));
    socket.emit('get_rooms');
    socket.on('new_room', (room: Room) => setRooms(prev => [...prev, room]));
    
    // 取消注册回调的清理函数
    const unsubscribe = onRoomMemberChange((event: RoomMemberEvent) => {
      if (currentRoom && event.roomId === currentRoom.id) {
        setMemberCount(event.count);
        setMemberEvent({ type: event.action, userId: event.user.id });
        
        // 5秒后清除成员事件显示
        setTimeout(() => {
          setMemberEvent(null);
        }, 5000);
      }
    });
    
    return () => {
      socket.off('room_list');
      socket.off('new_room');
      unsubscribe();
    };
  }, [currentRoom]);

  // 添加页面可见性变化处理
  useEffect(() => {
    // 处理页面可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('页面恢复到前台，检查连接状态...');
        // 尝试重新连接socket
        reconnectSocket();
        
        // 如果在房间中，刷新消息
        if (currentRoom) {
          console.log('刷新当前房间消息:', currentRoom.id);
          socket.emit('get_room_messages', currentRoom.id);
        }
      }
    };

    // 注册页面可见性变化事件
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentRoom]);

  // 直接加入房间：点击房间卡片或确认弹窗后调用
  const handleRoomSelect = async (roomId: string) => {
    // 如果已经在其他房间，则先离开
    if (currentRoom && currentRoom.id !== roomId) {
      leaveRoom(currentRoom.id);
    }
    const roomInfo = await getRoomById(roomId);
    if (!roomInfo) {
      setError(t('errorRoomNotFound', { roomId }));
      return;
    }
    joinRoom(roomId);
    setCurrentRoom(roomInfo);
    // 更新成员数量
    setMemberCount(getRoomMemberCount(roomId));
    // 进入房间时切换到聊天视图
    setView('chat');
    clearRoomUrlParam();
  };

  // URL 加载的房间确认操作
  const handleConfirmJoin = (confirmed: boolean) => {
    if (!confirmed || !roomToJoin) {
      setRoomToJoin(null);
      clearRoomUrlParam();
      return;
    }
    handleRoomSelect(roomToJoin.id);
    setRoomToJoin(null);
  };

  // 离开当前房间
  const handleLeaveRoom = () => {
    if (currentRoom) {
      leaveRoom(currentRoom.id);
      setCurrentRoom(null);
      // 修复BUG：离开房间时清除 URL 中的 room 参数，防止重复弹出加入房间确认弹窗
      clearRoomUrlParam();
    }
  };

  // 分享当前房间链接
  const handleShareRoom = () => {
    if (!currentRoom) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', currentRoom.id);
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        setError(null);
        setSuccess(t('shareSuccess'));
        setTimeout(() => setSuccess(null), 2000);
      })
      .catch(err => console.error('Could not copy URL:', err));
  };

  // 切换保存/取消保存房间
  const handleToggleSave = () => {
    if (!currentRoom) return;
    if (isRoomSaved(currentRoom.id)) {
      setSavedRooms(removeRoom(currentRoom.id));
    } else {
      setSavedRooms(saveRoom(currentRoom));
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setError(null);
        setSuccess(t('copySuccess'));
        setTimeout(() => setSuccess(null), 2000);
      })
      .catch(err => console.error('Could not copy text:', err));
  };

  // 保存用户名
  const handleSaveUsername = () => {
    const trimmedName = username.trim();
    if (!trimmedName) {
      setError(t('errorEmptyUsername'));
      return;
    }
    saveUsername(trimmedName);
    setShowEditUsername(false);
    setSuccess(t('usernameUpdated'));
    setTimeout(() => setSuccess(null), 2000);
  };

  return (
      <div className="flex flex-col h-screen">
        <Navbar isBordered maxWidth="full">
          <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-8 flex justify-between items-center">
            <NavbarBrand>
              <img 
                src="/message-system-logo.svg" 
                alt="Message System Logo" 
                className="w-10 h-10"
              />
              <p className="font-bold text-inherit ml-2">Message System</p>
            </NavbarBrand>
            <NavbarContent justify="end">
              <div className="flex items-center gap-2">

                <Tooltip content={t('yourUserId')}>
                  <Chip
                    variant="flat"
                    color="primary"
                    size="sm"
                    className="sm:flex cursor-pointer"
                    onClick={() => handleCopyToClipboard(clientId)}
                  >
                    ID: {clientId.slice(0, 8)}...
                  </Chip>
                </Tooltip>
                <Tooltip content={t('profile')}>
                  <Avatar
                    name={getAvatarText(username)}
                    color={getAvatarColor(username) as any}
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setView('settings')}
                  />
                </Tooltip>
                <LanguageSwitcher />
                <Button
                  isIconOnly
                  variant="light"
                  onPress={toggleTheme}
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                >
                  <Icon icon={isDark ? "lucide:sun" : "lucide:moon"} />
                </Button>
              </div>
            </NavbarContent>
          </div>
        </Navbar>

      {error && (
        <div className="bg-danger-100 p-3 text-danger">
          <div className="max-w-[1400px] mx-auto px-4 flex items-center gap-2">
            <Icon icon="lucide:alert-circle" />
            <p>{error}</p>
            <Button 
              size="sm" 
              variant="flat" 
              color="danger" 
              className="ml-auto"
              onPress={() => setError(null)}
            >
              {t('close')}
            </Button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-success-100 p-3 text-success">
          <div className="max-w-[1400px] mx-auto px-4 flex items-center gap-2">
            <Icon icon="lucide:check-circle" />
            <p>{success}</p>
          </div>
        </div>
      )}

      {/* Tab 切换：点击 rooms/saved 按钮仅切换视图，不影响已进入的房间 */}
      <div className="bg-default-100 border-b border-divider">
        <div className="max-w-[1400px] mx-auto px-4">
          <Tabs 
            selectedKey={view} 
            onSelectionChange={(key) => setView(key as 'chat' | 'rooms' | 'saved' | 'settings')}
            className="p-2"
          >
            <Tab key="rooms" title={t('yourRooms')} />
            <Tab key="saved" title={t('savedRooms')} />
            <Tab key="settings" title={
              <div className="flex items-center gap-2">
                <Icon icon="lucide:settings" className="text-sm" />
                {t('settings')}
              </div>
            } />
            {currentRoom && (
              <Tab key="chat" title={
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:home" className="text-sm" />
                  {currentRoom.name || t('room')}
                </div>
              } />
            )}
          </Tabs>
        </div>
      </div>

      <main className="flex-1 overflow-hidden bg-content1">
        <div className="max-w-[1400px] h-full mx-auto px-4">
          <div className="h-full bg-content1 rounded-lg flex flex-col">
            {isLoadingRoom ? (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <Icon icon="lucide:loader" className="w-16 h-16 mb-4 text-primary animate-spin" />
                <h2 className="text-xl font-semibold mb-2">{t('loading')}</h2>
                <p className="text-default-500 text-center">{t('loadingDescription')}</p>
              </div>
            ) : view === 'rooms' ? (
              <RoomList rooms={rooms} onRoomSelect={handleRoomSelect} />
            ) : view === 'saved' ? (
              <SavedRoomList 
                rooms={savedRooms} 
                onRoomSelect={handleRoomSelect} 
                onRoomsChange={setSavedRooms}
              />
            ) : view === 'settings' ? (
              // 设置页面 - 极简设计
              <div className="flex flex-col w-full max-w-md mx-auto p-6">
                {/* 头像展示 */}
                <div className="flex justify-center mb-8">
                  <Avatar
                    name={getAvatarText(username)}
                    color={getAvatarColor(username) as any}
                    size="lg"
                  />
                </div>
                
                {/* 资料列表 */}
                <div className="space-y-6">
                  {/* 用户名行 - 内联编辑 */}
                  <div className="flex items-center">
                    <div className="w-24 text-default-500">{t('username')}:</div>
                    {showEditUsername ? (
                      <div className="flex-1 flex gap-2">
                        <Input
                          autoFocus
                          size="sm"
                          className="flex-1"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveUsername();
                            if (e.key === 'Escape') setShowEditUsername(false);
                          }}
                        />
                        <div className="flex gap-1">
                          <Button 
                            isIconOnly
                            size="sm"
                            color="primary"
                            onPress={handleSaveUsername}
                          >
                            <Icon icon="lucide:check" className="text-sm" />
                          </Button>
                          <Button 
                            isIconOnly
                            size="sm"
                            variant="flat"
                            onPress={() => setShowEditUsername(false)}
                          >
                            <Icon icon="lucide:x" className="text-sm" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <code className="flex-1 bg-default-100 px-3 py-1 rounded text-sm font-semibold">{username}</code>
                        <Button 
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="min-w-0 w-8 h-8 ml-1"
                          onPress={() => setShowEditUsername(true)}
                        >
                          <Icon icon="lucide:edit" className="text-sm" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {/* ID行 */}
                  <div className="flex items-center">
                    <div className="w-24 text-default-500">{t('userId')}:</div>
                    <code className="flex-1 bg-default-100 px-3 py-1 rounded text-xs overflow-hidden text-ellipsis break-all">{clientId}</code>
                    <Button 
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="min-w-0 w-8 h-8 ml-1"
                      onPress={() => handleCopyToClipboard(clientId)}
                    >
                      <Icon icon="lucide:copy" className="text-sm" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Chat 视图
              currentRoom ? (
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-center p-2 border-b">
                    <div className="flex items-center">
                      <Button
                        isIconOnly
                        variant="light"
                        aria-label="Back"
                        onClick={() => {
                          setView('rooms');
                          clearRoomUrlParam();
                        }}
                        className="mr-2"
                      >
                        <Icon icon="lucide:chevron-left" width={24} />
                      </Button>
                      <div>
                        <h2 className="text-xl font-bold">{currentRoom.name}</h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-default-500">
                          <div className="flex items-center">
                            <Icon icon="lucide:users" className="mr-1" width={14} />
                            {memberCount} {t('members')}
                            {memberEvent && (
                              <span className="ml-1 text-tiny animate-fade-in">
                                {memberEvent.type === 'join' ? '👋' : '👋'} {memberEvent.userId.substring(0, 6)}...
                              </span>
                            )}
                          </div>
                          <div className="flex items-center cursor-pointer" onClick={() => handleCopyToClipboard(currentRoom.id)}>
                            <Icon icon="lucide:hash" className="mr-1" width={14} />
                            <Tooltip content={t('clickToCopyRoomId')}>
                              <span>{currentRoom.id.substring(0, 8)}...</span>
                            </Tooltip>
                          </div>
                          <div className="flex items-center">
                            <Icon icon="lucide:user" className="mr-1" width={14} />
                            {currentRoom.creatorId === clientId ? (
                              <span className="text-success-500">{t('createdBy')}</span>
                            ) : (
                              <span className="text-primary-500">{t('joined')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex">
                      <Button
                        isIconOnly
                        variant="light"
                        aria-label="Share"
                        onClick={handleShareRoom}
                        className="mr-1"
                      >
                        <Icon icon="lucide:share" width={20} />
                      </Button>
                      <Button
                        isIconOnly
                        variant="light"
                        aria-label="Save"
                        onClick={handleToggleSave}
                        className={isRoomSaved(currentRoom.id) ? "text-warning mr-1" : "text-primary mr-1"}
                      >
                        <Icon icon={isRoomSaved(currentRoom.id) ? "lucide:bookmark-minus" : "lucide:bookmark-plus"} width={20} />
                      </Button>
                      <Button
                        isIconOnly
                        variant="light"
                        aria-label="Leave"
                        onClick={handleLeaveRoom}
                        className="text-danger"
                      >
                        <Icon icon="lucide:log-out" width={20} />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex-grow overflow-y-auto px-2 pt-2">
                    <MessageList roomId={currentRoom.id} />
                  </div>
                  
                  <div className="border-t p-2">
                    <MessageInput 
                      roomId={currentRoom.id} 
                      username={username}
                      avatarText={getAvatarText(username)}
                      avatarColor={getAvatarColor(username)}
                    />
                  </div>
                </div>
              ) : (
                // 欢迎页面
                <div className="flex flex-col items-center justify-center h-full p-4">
                  <Icon icon="lucide:message-circle" className="w-16 h-16 mb-4 text-default-400" />
                  <h2 className="text-xl font-semibold mb-2">{t('welcomeMessage')}</h2>
                  <p className="text-default-500 mb-6 text-center">{t('welcomeDescription')}</p>
                  <Button 
                    color="primary" 
                    onPress={() => setView('rooms')}
                    startContent={<Icon icon="lucide:users" />}
                  >
                    {t('yourRooms')}
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </main>

      <footer className="bg-content1 border-t border-divider">
        <div className="max-w-[1400px] mx-auto px-4">
          {/* 移除这行代码，避免重复的输入框 */}
        </div>
      </footer>

      {/* URL 加载房间时的确认弹窗 */}
      {roomToJoin && (
        <Modal isOpen={!!roomToJoin} onClose={() => handleConfirmJoin(false)}>
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">{t('confirmJoinTitle')}</ModalHeader>
            <ModalBody>
              <p>{t('confirmJoinDescription', { roomName: roomToJoin.name })}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => handleConfirmJoin(false)}>
                {t('cancel')}
              </Button>
              <Button color="primary" onPress={() => handleConfirmJoin(true)}>
                {t('join')}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* 成员加入/离开提示 */}
      {memberEvent && (
        <div className={`flex items-center p-2 text-sm ${memberEvent.type === 'join' ? 'bg-green-50' : 'bg-red-50'}`}>
          <span className="flex items-center">
            {memberEvent.type === 'join' ? (
              <IoMdPersonAdd className="text-green-500 mr-1" />
            ) : (
              <IoMdRemove className="text-red-500 mr-1" />
            )}
            <span className="font-medium">
              {memberEvent.type === 'join' ? t('userJoined') : t('userLeft')}:
            </span>
            <span className="ml-1">{memberEvent.userId.substring(0, 8)}</span>
          </span>
        </div>
      )}
    </div>
  );
};
