import React, { useState, useEffect, useRef } from "react";
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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTheme } from "@heroui/use-theme";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { RoomList } from "../components/RoomList";
import { SavedRoomList } from "../components/SavedRoomList";
import {
  socket,
  joinRoom,
  leaveRoom,
  getRoomById,
  clientId,
  getRoomMemberCount,
  onRoomMemberChange,
  reconnectSocket,
} from "../utils/socket";
import { Room, RoomMemberEvent } from "../utils/types";
import { saveRoom, removeRoom, isRoomSaved, getSavedRooms } from "../utils/storage";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
// import { IoMdPersonAdd, IoMdRemove } from 'react-icons/io';

// 随机名字库 - 分为中文和英文两类，使用形容词+名词可爱组合
const CN_ADJECTIVES = ["可爱", "萌萌", "温柔", "活泼", "聪明", "快乐", "甜蜜", "淘气", "软软", "闪亮", "乖巧", "迷你"];
const CN_NOUNS = [
  "小猫",
  "小熊",
  "小兔",
  "小鹿",
  "小狐",
  "小鸭",
  "小狗",
  "小象",
  "小猪",
  "小鸟",
  "花朵",
  "星星",
  "气球",
];

const EN_ADJECTIVES = ["Fluffy", "Tiny", "Sweet", "Bubbly", "Cuddly", "Sparkly", "Happy", "Cozy", "Rosy", "Playful"];
const EN_NOUNS = [
  "Bunny",
  "Kitten",
  "Puppy",
  "Panda",
  "Cookie",
  "Muffin",
  "Star",
  "Fox",
  "Duckling",
  "Unicorn",
  "Whale",
];

// 生成随机名字 - 根据i18n语言设置决定生成中文还是英文名字
const generateRandomName = (language: string): string => {
  // 如果语言设置为中文，或者开头为zh（如zh-CN），则生成中文名字
  if (language === "zh" || language.startsWith("zh-")) {
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
  if (!name) return "?";
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
  if (!name) return "primary";
  // 简单哈希算法，根据名字生成固定颜色
  const colors = ["primary", "secondary", "success", "warning", "danger"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// 保存用户名到本地存储
const saveUsername = (name: string) => {
  localStorage.setItem("message-system_username", name);
  return name;
};

// 从本地存储获取用户名
const getStoredUsername = (): string => {
  return localStorage.getItem("message-system_username") || "";
};

// 保存当前视图状态到本地存储
const saveCurrentView = (view: string) => {
  localStorage.setItem("message-system_current_view", view);
};

// 从本地存储获取视图状态
const getStoredView = (): string => {
  return localStorage.getItem("message-system_current_view") || "rooms";
};

// 保存当前房间信息到本地存储
const saveCurrentRoom = (room: Room | null) => {
  if (room) {
    console.log("saveCurrentRoom: save room to storage", room)
    localStorage.setItem("message-system_current_room", JSON.stringify(room));
  } else {
    localStorage.removeItem("message-system_current_room");
  }
};

// 从本地存储获取房间信息
const getStoredRoom = (): Room | null => {
  const roomJson = localStorage.getItem("message-system_current_room");
  console.log("Stored room JSON:", roomJson);
  if (roomJson) {
    try {
      return JSON.parse(roomJson) as Room;
    } catch (e) {
      console.error("Failed to parse stored room:", e);
      localStorage.removeItem("message-system_current_room");
    }
  }
  return null;
};

export const MessagePage: React.FC = () => {
  // 添加初始化标志，防止初始渲染时清除存储的房间
  const isInitialMount = useRef(true);
  // 添加视口高度状态
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  // 状态简化：不再单独存储 roomId 和 joined 状态
  const [rooms, setRooms] = useState<Room[]>([]);
  const [savedRooms, setSavedRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  // 初始化视图状态，默认从localStorage读取
  const [view, setView] = useState<"chat" | "rooms" | "saved" | "settings">(() => {
    const storedView = getStoredView();
    return (storedView as "chat" | "rooms" | "saved" | "settings") || "rooms";
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  // 当 URL 参数包含房间时，先保存待确认的房间信息
  const [roomToJoin, setRoomToJoin] = useState<{ id: string; name: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // 添加房间成员数量状态
  const [memberCount, setMemberCount] = useState<number>(0);
  // 添加最近加入/离开消息状态
  const [memberEvent, setMemberEvent] = useState<{ type: "join" | "leave"; userId: string } | null>(null);
  // 添加用户名状态
  const [username, setUsername] = useState<string>("");
  // 是否显示修改用户名弹窗
  const [showEditUsername, setShowEditUsername] = useState<boolean>(false);

  // 修改处：同时获取 setSearchParams 方法
  const [searchParams, setSearchParams] = useSearchParams();

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  // 切换语言
  const toggleLanguage = () => {
    const newLanguage = i18n.language.startsWith("zh") ? "en" : "zh";
    i18n.changeLanguage(newLanguage);
  };

  // 修改处：使用 setSearchParams 更新 URL 参数
  const clearRoomUrlParam = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("room");
    setSearchParams(newParams);
  };

  // 添加: 更新视口高度的处理
  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    // 初始设置
    updateViewportHeight();

    // 监听事件
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
    };
  }, []);

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
      socket.emit("set_username", username);
    }
  }, [username]);

  // 视图变化时保存到localStorage
  useEffect(() => {
    if (view) {
      saveCurrentView(view);
    }
  }, [view]);

  // 当前房间变化时保存到localStorage
  useEffect(() => {
    // 跳过组件首次渲染时的保存操作，避免清除已存储的房间
    if (isInitialMount.current) {
      console.log("Initial mount - skip saving room to storage");
      isInitialMount.current = false;
      return;
    }
    
    console.log("Room changed - save current room state:", currentRoom ? currentRoom.id : "null");
    saveCurrentRoom(currentRoom);
  }, [currentRoom]);

  // 恢复保存的房间状态
  useEffect(() => {
    // 首先检查是否从URL加载房间
    console.log("Attempting to restore room from storage");
    const roomIdFromUrl = searchParams.get("room");
    
    if (roomIdFromUrl) {
      console.log("URL contains room ID, prioritize URL parameter:", roomIdFromUrl);
      // URL参数优先，这个逻辑不变
      return;
    }

    // 如果没有URL房间参数，且当前没有活跃房间，尝试从localStorage恢复
    if (!currentRoom && !isLoadingRoom) {
      const storedRoom = getStoredRoom();
      
      if (storedRoom) {
        setIsLoadingRoom(true);
        console.log("Found stored room, attempting to restore:", storedRoom.id);
        
        // 验证房间是否仍然存在
        getRoomById(storedRoom.id)
          .then((roomInfo) => {
            setIsLoadingRoom(false);
            if (roomInfo) {
              console.log("Successfully restored room:", roomInfo.name);
              joinRoom(storedRoom.id);
              setCurrentRoom(roomInfo);
              setMemberCount(getRoomMemberCount(storedRoom.id));
              
              // 根据保存的视图状态决定是否切换到chat视图
              const savedView = getStoredView();
              console.log("Restored room with saved view:", savedView);
              
              // 只有当保存的视图是chat时，才切换到chat视图
              if (savedView === "chat" && view !== "chat") {
                console.log("Switching to chat view based on saved view state");
                setView("chat");
              } else {
                console.log("Keeping current view:", view);
              }
            } else {
              console.log("Stored room no longer exists");
              // 房间不存在，清除存储
              saveCurrentRoom(null);
              setError(t("errorRoomNoLongerExists"));
            }
          })
          .catch((err) => {
            console.error("Error restoring room:", err);
            setIsLoadingRoom(false);
            saveCurrentRoom(null);
            setError(t("errorRestoringRoom"));
          });
      } else {
        console.log("No stored room found");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // 仅在组件挂载时执行一次

  // 当组件加载或 URL 参数变化时，如果 URL 包含 room 参数，则先加载房间信息并要求确认
  useEffect(() => {
    const roomIdFromUrl = searchParams.get("room");
    if (roomIdFromUrl && !currentRoom) {
      setIsLoadingRoom(true);
      getRoomById(roomIdFromUrl)
        .then((roomInfo) => {
          setIsLoadingRoom(false);
          if (roomInfo) {
            // 始终要求用户确认后进入房间
            setRoomToJoin({ id: roomIdFromUrl, name: roomInfo.name });
          } else {
            setError(t("errorRoomNotFound", { roomId: roomIdFromUrl }));
          }
        })
        .catch(() => {
          setIsLoadingRoom(false);
          setError(t("errorLoading"));
        });
    }
  }, [searchParams, currentRoom, t]);

  // 监听服务器返回的房间列表和新增房间
  useEffect(() => {
    socket.on("room_list", (roomList: Room[]) => setRooms(roomList));
    socket.emit("get_rooms");
    socket.on("new_room", (room: Room) => setRooms((prev) => [...prev, room]));

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
      socket.off("room_list");
      socket.off("new_room");
      unsubscribe();
    };
  }, [currentRoom]);

  // 添加页面可见性变化处理
  useEffect(() => {
    // 处理页面可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Page is visible, checking connection status...");
        // 尝试重新连接socket
        reconnectSocket();

        // 如果在房间中，刷新消息
        if (currentRoom) {
          console.log("Refreshing messages for current room:", currentRoom.id);
          socket.emit("get_room_messages", currentRoom.id);
        }
      }
    };

    // 注册页面可见性变化事件
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
      setError(t("errorRoomNotFound", { roomId }));
      return;
    }
    joinRoom(roomId);
    setCurrentRoom(roomInfo);
    // 更新成员数量
    setMemberCount(getRoomMemberCount(roomId));
    // 进入房间时切换到聊天视图
    setView("chat");
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
      // 明确清除localStorage中的房间信息
      saveCurrentRoom(null);
    }
  };

  // 分享当前房间链接
  const handleShareRoom = () => {
    if (!currentRoom) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("room", currentRoom.id);
    navigator.clipboard
      .writeText(url.toString())
      .then(() => {
        setError(null);
        setSuccess(t("shareSuccess"));
        setTimeout(() => setSuccess(null), 2000);
      })
      .catch((err) => console.error("Could not copy URL:", err));
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
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setError(null);
        setSuccess(t("copySuccess"));
        setTimeout(() => setSuccess(null), 2000);
      })
      .catch((err) => console.error("Could not copy text:", err));
  };

  // 保存用户名
  const handleSaveUsername = () => {
    const trimmedName = username.trim();
    if (!trimmedName) {
      setError(t("errorEmptyUsername"));
      return;
    }
    saveUsername(trimmedName);
    setShowEditUsername(false);
    setSuccess(t("usernameUpdated"));
    setTimeout(() => setSuccess(null), 2000);
  };

  return (
    // 修改: 使用动态计算的视口高度而不是 h-screen
    <div className="flex flex-col overflow-hidden" style={{ height: `${viewportHeight}px` }}>
      <Navbar isBordered maxWidth="full">
        <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-8 flex justify-between items-center">
          <NavbarBrand>
            <img src="/message-system-logo.svg" alt="Message System Logo" className="w-10 h-10" />
            <p className="font-bold text-inherit ml-2">Message System</p>
          </NavbarBrand>
          <NavbarContent justify="end">
            <div className="flex items-center gap-2">
              {/* 始终显示的用户ID */}
              <Tooltip content={t("yourUserId")}>
                <Chip
                  variant="flat"
                  color="primary"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => handleCopyToClipboard(clientId)}
                >
                  ID: {clientId.slice(0, 8)}...
                </Chip>
              </Tooltip>

              {/* 桌面版：直接显示头像、语言切换和主题切换 */}
              <div className="hidden md:flex items-center gap-2">
                <Avatar name={getAvatarText(username)} color={getAvatarColor(username) as any} size="sm" />
                <Tooltip content={i18n.language.startsWith("zh") ? "Switch to English" : "切换到中文"}>
                  <Button isIconOnly variant="light" onPress={toggleLanguage} aria-label="Change language">
                    <Icon icon="lucide:languages" width={20} />
                  </Button>
                </Tooltip>
                <Tooltip content={isDark ? t("lightMode") : t("darkMode")}>
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={toggleTheme}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    <Icon icon={isDark ? "lucide:sun" : "lucide:moon"} width={20} />
                  </Button>
                </Tooltip>
              </div>

              {/* 移动版：显示头像但使用三点菜单作为下拉触发器 */}
              <div className="flex md:hidden items-center gap-2">
                <Avatar name={getAvatarText(username)} color={getAvatarColor(username) as any} size="sm" />
                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly variant="light" aria-label="Menu" className="min-w-0">
                      <Icon icon="lucide:more-vertical" width={20} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="User actions">
                    <DropdownItem
                      key="settings"
                      startContent={<Icon icon="lucide:settings" />}
                      onPress={() => setView("settings")}
                    >
                      {t("settings")}
                    </DropdownItem>
                    <DropdownItem
                      key="language"
                      startContent={<Icon icon="lucide:languages" />}
                      onPress={toggleLanguage}
                    >
                      {i18n.language.startsWith("zh") ? "English" : "中文"}
                    </DropdownItem>
                    <DropdownItem
                      key="theme"
                      startContent={<Icon icon={isDark ? "lucide:sun" : "lucide:moon"} />}
                      onPress={toggleTheme}
                    >
                      {isDark ? t("lightMode") : t("darkMode")}
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
          </NavbarContent>
        </div>
      </Navbar>

      {error && (
        <div className="bg-danger-100 p-3 text-danger">
          <div className="max-w-[1400px] mx-auto px-4 flex items-center gap-2">
            <Icon icon="lucide:alert-circle" />
            <p>{error}</p>
            <Button size="sm" variant="flat" color="danger" className="ml-auto" onPress={() => setError(null)} aria-label={t("close")}>
              {t("close")}
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
            onSelectionChange={(key) => setView(key as "chat" | "rooms" | "saved" | "settings")}
            className="p-2"
            variant="light" // 尝试使用更轻量的变体
            // 或者完全自定义样式
            classNames={{
              tabList: "gap-2",
              tab: "data-[selected=true]:bg-transparent data-[selected=true]:shadow-none border-none",
              cursor: "bg-transparent shadow-none", // 移除选中指示器
            }}
          >
            <Tab
              key="rooms"
              aria-label={t("yourRooms")}
              title={
                <Tooltip content={t("yourRooms")}>
                  <div className="flex items-center gap-1">
                    <Icon icon="lucide:home" className="text-lg" />
                  </div>
                </Tooltip>
              }
            />
            <Tab
              key="saved"
              aria-label={t("savedRooms")}
              title={
                <Tooltip content={t("savedRooms")}>
                  <div className="flex items-center gap-1">
                    <Icon icon="lucide:bookmark" className="text-lg" />
                  </div>
                </Tooltip>
              }
            />
            <Tab
              key="settings"
              aria-label={t("settings")}
              title={
                <Tooltip content={t("settings")}>
                  <div className="flex items-center gap-1">
                    <Icon icon="lucide:settings" className="text-lg" />
                  </div>
                </Tooltip>
              }
            />
            {currentRoom && (
              <Tab
                key="chat"
                aria-label={t("chatRoom", { name: currentRoom.name })}
                title={
                  <Tooltip content={currentRoom.name}>
                    <div className="flex items-center gap-1">
                      <Icon icon="lucide:message-circle" className="text-lg" />
                      <span className="max-w-24 truncate text-xs hidden sm:inline-block">
                        {currentRoom.name || t("room")}
                      </span>
                    </div>
                  </Tooltip>
                }
              />
            )}
          </Tabs>
        </div>
      </div>

      {/* 修改: 确保内容区有正确的滚动设置 */}
      <main className="flex-1 overflow-hidden bg-content1">
        <div className="h-full max-w-[1400px] mx-auto px-4">
          <div className="h-full bg-content1 rounded-lg flex flex-col">
            {isLoadingRoom ? (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <Icon icon="lucide:loader" className="w-16 h-16 mb-4 text-primary animate-spin" />
                <h2 className="text-xl font-semibold mb-2">{t("loading")}</h2>
                <p className="text-default-500 text-center">{t("loadingDescription")}</p>
              </div>
            ) : view === "rooms" ? (
              <div className="h-full overflow-y-auto">
                <RoomList rooms={rooms} onRoomSelect={handleRoomSelect} />
              </div>
            ) : view === "saved" ? (
              <div className="h-full overflow-y-auto">
                <SavedRoomList rooms={savedRooms} onRoomSelect={handleRoomSelect} onRoomsChange={setSavedRooms} />
              </div>
            ) : view === "settings" ? (
              // 设置页面 - 极简设计
              <div className="flex flex-col w-full max-w-md mx-auto p-6 h-full overflow-y-auto">
                {/* 头像展示 */}
                <div className="flex flex-col items-center mb-8">
                  <Avatar name={getAvatarText(username)} color={getAvatarColor(username) as any} size="lg" />
                  <p className="text-sm text-default-500 mt-2">{t("profile")}</p>
                </div>

                {/* 资料列表 */}
                <div className="space-y-6">
                  {/* 用户名行 - 内联编辑 */}
                  <div className="flex items-center">
                    <div className="w-24 text-default-500">{t("username")}:</div>
                    {showEditUsername ? (
                      <div className="flex-1 flex gap-2">
                        <Input
                          autoFocus
                          size="sm"
                          className="flex-1"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveUsername();
                            if (e.key === "Escape") setShowEditUsername(false);
                          }}
                        />
                        <div className="flex gap-1">
                          <Button isIconOnly size="sm" color="primary" onPress={handleSaveUsername} aria-label={t("save")}>
                            <Icon icon="lucide:check" className="text-sm" />
                          </Button>
                          <Button isIconOnly size="sm" variant="flat" onPress={() => setShowEditUsername(false)} aria-label={t("cancel")}>
                            <Icon icon="lucide:x" className="text-sm" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <code className="flex-1 bg-default-100 px-3 py-1 rounded text-sm font-semibold">
                          {username}
                        </code>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="min-w-0 w-8 h-8 ml-1"
                          onPress={() => setShowEditUsername(true)}
                          aria-label={t("editUsername")}
                        >
                          <Icon icon="lucide:edit" className="text-sm" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* ID行 */}
                  <div className="flex items-center">
                    <div className="w-24 text-default-500">{t("userId")}:</div>
                    <code className="flex-1 bg-default-100 px-3 py-1 rounded text-xs overflow-hidden text-ellipsis break-all">
                      {clientId}
                    </code>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="min-w-0 w-8 h-8 ml-1"
                      onPress={() => handleCopyToClipboard(clientId)}
                      aria-label={t("copyUserId")}
                    >
                      <Icon icon="lucide:copy" className="text-sm" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : // Chat 视图
            currentRoom ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center p-2 border-b">
                  <div className="flex items-center">
                    <Button
                      isIconOnly
                      variant="light"
                      aria-label="Back"
                      onPress={() => {
                        setView("rooms");
                        clearRoomUrlParam();
                      }}
                      className="mr-2"
                    >
                      <Icon icon="lucide:chevron-left" width={24} />
                    </Button>
                    <div>
                      <h2 className="text-xl font-bold truncate max-w-[150px]">{currentRoom.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-default-500">
                        <div className="flex items-center">
                          <Icon icon="lucide:users" className="mr-1" width={14} />
                          {memberCount}
                          {memberEvent && (
                            <span className="ml-1 text-tiny animate-fade-in">
                              {memberEvent.type === "join" ? "🎉" : "🚶"} {memberEvent.userId.substring(0, 4)}...
                            </span>
                          )}
                        </div>
                        <div
                          className="flex items-center cursor-pointer"
                          onClick={() => handleCopyToClipboard(currentRoom.id)}
                        >
                          <Icon icon="lucide:hash" className="mr-1" width={14} />
                          <Tooltip content={t("clickToCopyRoomId")}>
                            <span>
                              {currentRoom.id.length > 10 ? `${currentRoom.id.substring(0, 8)}...` : currentRoom.id}
                            </span>
                          </Tooltip>
                          <Icon icon="lucide:copy" className="ml-1 text-default-400" width={12} />
                        </div>
                        {/* <div className="flex items-center">
                          <Icon icon="lucide:user" className="mr-1" width={14} />
                          {currentRoom.creatorId === clientId ? (
                            <span className="text-success-500">{t("createdBy")}</span>
                          ) : (
                            <span className="text-primary-500">{t("joined")}</span>
                          )}
                        </div> */}
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <Button
                      isIconOnly
                      variant="light"
                      aria-label="Share"
                      onPress={handleShareRoom}
                      className="mr-1 md:w-10 md:h-10 w-8 h-8"
                    >
                      {" "}
                      {/* 添加宽高控制 */}
                      <Icon icon="lucide:share" width={20} className="md:w-5 w-4" /> {/* 调整图标大小 */}
                    </Button>
                    <Button
                      isIconOnly
                      variant="light"
                      aria-label="Save"
                      onPress={handleToggleSave}
                      className={`${isRoomSaved(currentRoom.id) ? "text-warning" : "text-primary"} mr-1 md:w-10 md:h-10 w-8 h-8`}
                    >
                      <Icon
                        icon={isRoomSaved(currentRoom.id) ? "lucide:bookmark-minus" : "lucide:bookmark-plus"}
                        width={20}
                        className="md:w-5 w-4"
                      />
                    </Button>
                    <Button
                      isIconOnly
                      variant="light"
                      aria-label="Leave"
                      onPress={handleLeaveRoom}
                      className="text-danger md:w-10 md:h-10 w-8 h-8"
                    >
                      <Icon icon="lucide:log-out" width={20} className="md:w-5 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pt-2">
                  <MessageList roomId={currentRoom.id} />
                </div>

                <div className="border-t p-2 flex-shrink-0">
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
              <div className="flex flex-col items-center justify-center h-full p-4 overflow-y-auto">
                <Icon icon="lucide:message-circle" className="w-16 h-16 mb-4 text-default-400" />
                <h2 className="text-xl font-semibold mb-2">{t("welcomeMessage")}</h2>
                <p className="text-default-500 mb-6 text-center">{t("welcomeDescription")}</p>
                <Button color="primary" onPress={() => setView("rooms")} startContent={<Icon icon="lucide:users" />}>
                  {t("yourRooms")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* URL 加载房间时的确认弹窗 */}
      {roomToJoin && (
        <Modal isOpen={!!roomToJoin} onClose={() => handleConfirmJoin(false)}>
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">{t("confirmJoinTitle")}</ModalHeader>
            <ModalBody>
              <p>{t("confirmJoinDescription", { roomName: roomToJoin.name })}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => handleConfirmJoin(false)}>
                {t("cancel")}
              </Button>
              <Button color="primary" onPress={() => handleConfirmJoin(true)}>
                {t("join")}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* 成员加入/离开提示已在其他位置实现，此处不再重复 */}
    </div>
  );
};
