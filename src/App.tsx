import catalogData from "./catalog.json";
import { motion, AnimatePresence } from "motion/react";
import toast, { Toaster } from "react-hot-toast";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { 
  MessageSquare, 
  Settings, 
  CheckCircle, 
  ExternalLink, 
  Copy, 
  Zap, 
  ShoppingBag, 
  Phone, 
  Cpu, 
  DollarSign, 
  ChevronRight, 
  Database, 
  Truck, 
  Box, 
  TrendingUp,
  Package,
  Clock,
  User,
  MapPin,
  RefreshCw,
  Plus,
  Send,
  Share2,
  LogOut,
  AlertTriangle,
  History,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  Check,
  CheckCheck,
  Play,
  Pause,
  Bell,
  Calendar,
  Trash2,
  Layout,
  Instagram,
  MessageCircle,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  Smartphone,
  Download
} from "lucide-react";
import { 
  requestNotificationPermission, 
  playSoundAlert, 
  speakVoiceAlert, 
  triggerNativeEventAlert 
} from "./utils/nativeNotifications";
import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import { 
  db, 
  auth, 
  storage, 
  handleSupabaseError,
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  serverTimestamp,
  limit,
  ref, 
  uploadBytes, 
  getDownloadURL,
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  loginWithPhoneOrName,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  signUpWithEmailAndPassword,
  SupabaseUser as FirebaseUser
} from "./supabase";
import { cn, getProxiedImageUrl } from "./lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  JAN_RESPONSE_SCHEMA, 
  captureOrderTool, 
  checkInventoryTool, 
  updateCustomerProfileTool
} from "./lib/janAgent";

// Type definitions
type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  addressIndicator?: string;
  city: string;
  productName: string;
  productId: string;
  quantity: number;
  totalPrice: number;
  status: 'pendiente' | 'confirmado' | 'despachado' | 'entregado' | 'cancelado';
  createdAt: any;
  notes?: string;
};

type Product = {
  id: string;
  docId?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  currency: string;
  category: string;
  cost?: number;
  freight?: number;
  provider?: string;
  imageUrl?: string;
  videoUrl?: string;
  storeId?: string;
};

type Activity = {
  id: string;
  from: string;
  to?: string;
  message: string;
  status: 'recibido' | 'procesando' | 'respondido' | 'error';
  whatsappStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  manualAgent?: string;
  statusUpdateAt?: any;
  response?: string;
  timestamp: any;
  receivedAt?: any;
  processingAt?: any;
  respondedAt?: any;
  errorAt?: any;
  customerPhone?: string;
  customerName?: string;
  recipient?: string;
  senderType?: string;
  botNumber?: string;
  platform?: string;
  createdAt?: any;
  type?: string;
  text?: string;
};

// Safe date formatter
const safeFormat = (ts: any, pattern: string) => {
  if (!ts) return "--:--:--";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (!(d instanceof Date) || isNaN(d.getTime())) return "--:--:--";
    return format(d, pattern, { locale: es });
  } catch (e) {
    return "--:--:--";
  }
};

// Proper Error Boundary
class AppErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) { console.error("Render Crash:", error, info); }
  render() {
    if ((this.state as any).hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-neutral-900 rounded-3xl border border-red-900/20 text-center space-y-4">
          <AlertTriangle className="text-red-500 w-12 h-12" />
          <h2 className="text-xl font-bold text-white uppercase italic font-serif">¡Qué pena parce, se nos tostó la pantalla!</h2>
          <p className="text-neutral-500 text-sm max-w-sm">Hubo un error cargando esta sección. Intenta recargar la página o volver al dashboard.</p>
          <button onClick={() => window.location.reload()} className="bg-dark-accent text-black px-6 py-2 rounded-xl font-bold uppercase text-xs">Recargar Panel</button>
        </div>
      );
    }
    return (this.props as any).children;
  }
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Catalog from "./components/Catalog";

function JanAdmin() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("otp");
  const [authStep, setAuthStep] = useState<"login" | "otp">("login");
  const [otpCode, setOtpCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [configStatus, setConfigStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, any>>({});

  const [humanMessage, setHumanMessage] = useState("");
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'orders' | 'inventory' | 'reports' | 'config' | 'recovery' | 'monitor'>('dashboard');

  // Native System & Voice Notifications (Windows / Android / Mac)
  const [nativeNotificationsEnabled, setNativeNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("native_notifications_enabled") !== "false";
  });
  const nativeNotificationsEnabledRef = useRef(nativeNotificationsEnabled);
  const isInitialOrdersRef = useRef(true);
  const isInitialActivityRef = useRef(true);
  const appStartTimeRef = useRef(Date.now());

  // PWA Mobile App Download / Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success("¡App Jansel AI instalada con éxito en tu pantalla de inicio!");
      }
      setDeferredPrompt(null);
    } else {
      toast("📱 Para instalar en Celular o PC:\n1. En Chrome/Android: toca los 3 puntos (⋮) y selecciona 'Instalar aplicación' o 'Agregar a pantalla de inicio'.\n2. En Safari/iPhone: toca 'Compartir' (Icono cuadrado con flecha) y 'Agregar a inicio'.", {
        duration: 9000,
        icon: '📱'
      });
    }
  };

  useEffect(() => {
    nativeNotificationsEnabledRef.current = nativeNotificationsEnabled;
    localStorage.setItem("native_notifications_enabled", String(nativeNotificationsEnabled));
  }, [nativeNotificationsEnabled]);

  const [userStore, setUserStore] = useState<any>(null);
  const [userStores, setUserStores] = useState<any[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    const url = window.location.origin + "/api/webhook/whatsapp";
    setWebhookUrl(url);
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadStore = async () => {
      try {
        const defSnap = await getDoc(doc(db, "stores", "default"));
        let finalStore;
        if (!defSnap.exists()) {
           const baseStore = {
             ownerId: user.uid,
             name: "JANSEL SHOP",
             slug: "jansel-shop",
             botName: "Jan",
             botTone: "paisa, carismático y respetuoso",
             botGoal: "persuadir y cerrar ventas rápido",
             themeColor: "#F27D26"
           };
           await setDoc(doc(db, "stores", "default"), baseStore);
           finalStore = { id: "default", ...baseStore };
        } else {
           finalStore = { id: "default", ...defSnap.data() };
        }
        
        setUserStores([finalStore]);
        setUserStore(finalStore);
      } catch(e) {
        console.error("Error loading store", e);
      } finally {
        setStoreLoading(false);
      }
    };
    loadStore();
  }, [user]);

  useEffect(() => {
    if (!user || !userStore) return;

    let qOrders, qProducts, qActivity, qCustomers, qConversations;

    qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    qProducts = query(collection(db, "products"), orderBy("name", "asc"));
    qActivity = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(200));
    qCustomers = collection(db, "customers");
    qConversations = collection(db, "conversations");

    const unsubOrders = onSnapshot(qOrders, 
      (snapshot) => {
        let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        setOrders(docs);

        if (!isInitialOrdersRef.current) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const ord = change.doc.data();
              const ordTime = ord.createdAt || Date.now();
              if (ordTime >= appStartTimeRef.current - 10000) {
                triggerNativeEventAlert({
                  title: "🛒 ¡Nuevo Pedido Recibido!",
                  body: `Cliente: ${ord.customerName || "Anónimo"} - $${(ord.totalPrice || 0).toLocaleString("es-CO")} COP`,
                  voiceText: `¡Atención! Nuevo pedido recibido de ${ord.customerName || "un cliente"} por ${(ord.totalPrice || 0).toLocaleString("es-CO")} pesos.`,
                  type: "order",
                  enabled: nativeNotificationsEnabledRef.current
                });
              }
            }
          });
        } else {
          isInitialOrdersRef.current = false;
        }
      },
      (err) => {
        if (err.code === 'cancelled' || err.message?.includes('CANCELLED')) return;
        console.error("[Firestore] Orders error:", err);
      }
    );

    const unsubProducts = onSnapshot(qProducts, 
      (snapshot) => {
        let docs = snapshot.docs.map(d => {
          const data = d.data() as Product;
          const match = (catalogData.products as any[]).find(cp => cp.id === data.id || cp.id === d.id);
          const finalImg = match?.imageUrl || data.imageUrl;
          return { docId: d.id, ...data, imageUrl: finalImg } as Product;
        });
        setProducts(docs);
      },
      (err) => {
        if (err.code === 'cancelled' || err.message?.includes('CANCELLED')) return;
        console.error("[Firestore] Products error:", err);
      }
    );

    const unsubActivity = onSnapshot(qActivity, 
      (snapshot) => {
        let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        setActivities(docs);

        if (!isInitialActivityRef.current) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const act = change.doc.data();
              const actTime = act.timestamp || Date.now();
              if (actTime >= appStartTimeRef.current - 10000) {
                if (act.type === 'add_to_cart') {
                  triggerNativeEventAlert({
                    title: "🛒 Producto en Carrito",
                    body: act.message || "Un producto fue añadido al carrito",
                    voiceText: `¡Un visitante añadió un producto al carrito de compras!`,
                    type: "cart",
                    enabled: nativeNotificationsEnabledRef.current
                  });
                } else if (act.type === 'page_view') {
                  triggerNativeEventAlert({
                    title: "👀 Visita en Tienda Web",
                    body: act.message || "Nuevo visitante explorando la tienda",
                    voiceText: `Nuevo visitante en la tienda online.`,
                    type: "visitor",
                    enabled: nativeNotificationsEnabledRef.current
                  });
                } else if (act.type === 'human_takeover_needed' || act.message?.toLowerCase().includes('humano') || act.message?.toLowerCase().includes('agente')) {
                  triggerNativeEventAlert({
                    title: "🚨 Solicitud de Agente Humano",
                    body: act.message || "Un cliente requiere soporte humano",
                    voiceText: `¡Atención urgente! Un cliente solicita atención de un agente humano en el chat.`,
                    type: "alert",
                    enabled: nativeNotificationsEnabledRef.current
                  });
                } else if (act.type === 'incoming_message' || act.type === 'chat' || act.whatsappStatus === 'received') {
                  triggerNativeEventAlert({
                    title: `💬 Mensaje de ${act.customerName || 'Cliente'}`,
                    body: act.message || "Nuevo mensaje recibido",
                    voiceText: `Nuevo mensaje de ${act.customerName || 'un cliente'}: ${act.message?.slice(0, 50) || ''}`,
                    type: "message",
                    enabled: nativeNotificationsEnabledRef.current
                  });
                }
              }
            }
          });
        } else {
          isInitialActivityRef.current = false;
        }
      },
      (err) => {
        if (err.code === 'cancelled' || err.message?.includes('CANCELLED')) return;
        console.error("[Firestore] Activity error:", err);
      }
    );
    
    // CRM
    const unsubCustomers = onSnapshot(qCustomers, 
      (snapshot) => {
        let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // local sort to avoid need of index for now because we might vary order fields
        docs.sort((a: any, b: any) => (b.ultima_interaccion?.toMillis?.() || 0) - (a.ultima_interaccion?.toMillis?.() || 0));
        setCustomers(docs);
      },
      (err) => {
        if (err.code === 'cancelled' || err.message?.includes('CANCELLED')) return;
        console.error("[Firestore] Customers error:", err);
      }
    );

    const unsubConversations = onSnapshot(qConversations, 
      (snapshot) => {
        const convs: Record<string, any> = {};
        snapshot.docs.forEach(d => {
          const data = d.data();
          convs[d.id] = data;
        });
        setConversations(convs);
      },
      (err) => {
        if (err.code === 'cancelled' || err.message?.includes('CANCELLED')) {
          console.debug("[Firestore] Conversations stream cancelled (expected on unmount)");
        } else {
          console.error("[Firestore] Conversations error:", err);
        }
      }
    );

    return () => {
      unsubOrders();
      unsubProducts();
      unsubActivity();
      unsubCustomers();
      unsubConversations();
    };
  }, [user, userStore]);

  useEffect(() => {
    if (!user) return;
    const unsubStatus = onSnapshot(doc(db, "config", "system"), 
      (snap) => {
        if (snap.exists()) {
          setSystemStatus(snap.data());
        }
      },
      (err) => {
        if (err.code === 'cancelled' || err.message?.includes('CANCELLED')) {
          console.debug("[Firestore] System status stream cancelled");
        } else {
          console.error("[Firestore] System status error:", err);
        }
      }
    );
    return () => unsubStatus();
  }, [user]);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === "auth/popup-blocked") {
        setLoginError("El navegador bloqueó la ventana. Por favor permite los popups y refresca.");
      } else if (err.code === "auth/cancelled-popup-request") {
        setLoginError("Ya tienes una ventana de ingreso abierta.");
      } else if (err.code === "auth/internal-error" || err.message?.includes("Pending promise")) {
        setLoginError("Error interno. Recarga la página e intenta de nuevo.");
      } else if (err.code !== "auth/popup-closed-by-user") {
        setLoginError("No se pudo iniciar sesión. Intenta otra vez.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      if (authMethod === "password") {
        if (!identifier || !password) {
          setLoginError("Por favor ingresa tu nombre/teléfono y la contraseña.");
          setIsLoggingIn(false);
          return;
        }
        await loginWithPhoneOrName(identifier, password);
      } else {
        // OTP Mode
        if (authStep === "login") {
          if (!identifier) {
            setLoginError("Por favor ingresa tu número de teléfono.");
            setIsLoggingIn(false);
            return;
          }
          await signInWithPhoneOtp(identifier);
          setAuthStep("otp");
        } else {
          if (!otpCode) {
            setLoginError("Por favor ingresa el código OTP.");
            setIsLoggingIn(false);
            return;
          }
          await verifyPhoneOtp(identifier, otpCode);
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setLoginError(err.message || "Error de acceso.");
    } finally {
      setIsLoggingIn(false);
    }
  };
  const logout = () => signOut(auth);

  const clearTransactions = async () => {
    if (isClearing) return;
    if (!confirm("⚠️ ¡ADVERTENCIA CRÍTICA! Se borrarán todos los pedidos y actividades de prueba. Esta acción no se puede deshacer. ¿Deseas reiniciar el tablero para empezar ventas reales?")) return;
    
    setIsClearing(true);
    try {
      const res = await fetch("/api/admin/clear-transactions", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: userStore?.id || "default" })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("¡Viento en popa! El tablero ha sido reiniciado.");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!startDate && !endDate) return orders;
    return orders.filter(o => {
      const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      if (startDate && date < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      return true;
    });
  }, [orders, startDate, endDate]);

  const filteredActivities = useMemo(() => {
    if (!startDate && !endDate) return activities;
    return activities.filter(a => {
      const date = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      if (startDate && date < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      return true;
    });
  }, [activities, startDate, endDate]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateStock = async (docId: string, newStock: number) => {
    try {
      await updateDoc(doc(db, "products", docId), { stock: Math.max(0, newStock) });
    } catch (err) {
      console.error("Error updating stock:", err);
      handleSupabaseError(err, "update", `products/${docId}`);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status'], notifyCustomer: boolean = true) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      await updateDoc(doc(db, "orders", orderId), { status });

      if (notifyCustomer) {
        toast.loading("Enviando WhatsApp de actualización al cliente...", { id: "status_notify_" + orderId });
        
        const res = await fetch("/api/orders/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            status,
            notifyCustomer: true,
            orderData: targetOrder
          })
        });
        const data = await res.json();

        if (data.success && data.notificationSent) {
          toast.success(`📱 ¡Mensaje de "${status.toUpperCase()}" enviado por WhatsApp a ${targetOrder?.customerName || 'cliente'}!`, {
            id: "status_notify_" + orderId,
            duration: 5000
          });
        } else if (data.success) {
          toast.success(`Estado actualizado a "${status.toUpperCase()}"`, {
            id: "status_notify_" + orderId
          });
        } else {
          toast.error(`Error enviando notificación: ${data.error || 'Error desconocido'}`, {
            id: "status_notify_" + orderId
          });
        }
      } else {
        toast.success(`Estado cambiado a "${status.toUpperCase()}"`);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      handleSupabaseError(err, "update", `orders/${orderId}`);
    }
  };

  const resetDatabase = async (storeId?: string) => {
    if (isResetting) return;
    const targetStore = storeId || userStore?.id || "default";
    if (!confirm(`⚠️ ¿Estás seguro? Se borrará el catálogo actual de la tienda ${targetStore} y se cargará el estandar desde el servidor.`)) return;
    
    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, storeId: targetStore })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("¡Melo! Catálogo sincronizado con éxito desde el servidor.");
      } else {
        throw new Error(data.error || "Error en el servidor");
      }
    } catch (err: any) {
      console.error("Error resetting DB:", err);
      toast.error(`Hubo un problema: ${err.message || "Error desconocido"}`);
    } finally {
      setIsResetting(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-dark-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-6 bg-neutral-900/50 p-8 rounded-3xl border border-neutral-800 backdrop-blur-xl shadow-2xl"
        >
          <div className="mx-auto w-16 h-16 bg-dark-accent/10 rounded-2xl flex items-center justify-center border border-dark-accent/20">
            <Cpu className="w-8 h-8 text-dark-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-serif italic text-dark-accent">JANSEL SHOP</h1>
            <p className="text-neutral-500 text-sm mt-1">Acceso exclusivo al panel de control de ventas y pedidos.</p>
          </div>
          
          <div className="flex justify-center">
            <div className="flex items-center gap-2 bg-dark-green/10 text-dark-green text-[10px] font-black px-4 py-1.5 rounded-full border border-dark-green/20 animate-pulse">
              <Zap size={12} /> CEREBRO (API) ACTIVADO
            </div>
          </div>

          <div className="flex bg-neutral-900 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setAuthMethod("otp"); setAuthStep("login"); setLoginError(null); }}
              className={cn("flex-1 text-xs font-bold py-2 rounded-lg transition-colors", authMethod === "otp" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300")}
            >
              SMS / WhatsApp
            </button>
            <button
              onClick={() => { setAuthMethod("password"); setAuthStep("login"); setLoginError(null); }}
              className={cn("flex-1 text-xs font-bold py-2 rounded-lg transition-colors", authMethod === "password" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300")}
            >
              Contraseña
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-left">
            {authMethod === "otp" ? (
              <>
                {authStep === "login" ? (
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      Número de Teléfono
                    </label>
                    <PhoneInput
                      defaultCountry="CO"
                      value={identifier}
                      onChange={(v) => setIdentifier(v || "")}
                      placeholder="+57 300 123 4567"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus-within:border-dark-accent transition-colors text-white PhoneInput-custom"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      Código de Verificación (OTP)
                    </label>
                    <input
                      type="text"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-dark-accent transition-colors text-white text-center tracking-widest text-lg font-mono"
                    />
                    <button type="button" onClick={() => setAuthStep("login")} className="text-[10px] text-neutral-500 mt-2 underline">Cambiar número</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Usuario o Correo
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Ingresa tu usuario"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-dark-accent transition-colors text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-dark-accent transition-colors text-white"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : null}
              {authMethod === "otp" ? (authStep === "login" ? "Enviar Código SMS" : "Verificar e Ingresar") : "Ingresar al Panel"}
            </button>
          </form>

          {loginError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-900/10 border border-red-900/20 p-4 rounded-xl flex items-start gap-3 text-left mt-4"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-tight">{loginError}</p>
            </motion.div>
          )}
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest pt-2">Powered by Supabase & Google AI Studio</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-300 font-sans flex flex-col lg:flex-row overflow-hidden relative">
      {user && <AIProcessor user={user} />}
      {/* Mobile Header */}
      <header className="lg:hidden h-14 bg-black border-b border-neutral-800 flex items-center justify-between px-4 sticky top-0 z-40 w-full shrink-0">
        <div className="flex items-center gap-2">
           <img src="/images/logo.jpeg" alt="Logo" className="w-6 h-6 rounded-lg object-cover" />
           <span className="font-serif italic text-lg text-dark-accent">JANSEL SHOP</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallPWA}
            className="flex items-center gap-1 text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
            title="Instalar Jansel AI como App Móvil"
          >
            <Smartphone size={13} className="text-amber-400 shrink-0" />
            <span>Instalar App</span>
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-neutral-400 hover:text-white"
          >
            {isSidebarOpen ? <Plus size={24} className="rotate-45" /> : <Settings size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-black border-r border-neutral-800 flex flex-col h-screen shrink-0 z-50 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-64",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 hidden lg:block border-b border-neutral-900/60 mb-2">
          <div className="flex items-center gap-3">
            <img src="/images/logo.jpeg" alt="Jansel Logo" className="w-9 h-9 rounded-xl object-cover border border-amber-500/30 shadow-md shrink-0" />
            <div>
              <h1 className="font-serif italic text-xl text-dark-accent tracking-tight leading-none">JANSEL SHOP</h1>
              <p className="text-[8px] text-neutral-500 uppercase tracking-[0.2em] mt-1 font-bold">Sales Architecture AI</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 lg:py-0 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={18} />} label="Dashboard" />
          <NavItem active={activeTab === 'crm'} onClick={() => setActiveTab('crm')} icon={<User size={18} />} label="CRM / Pipeline" />
          <NavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<History size={18} />} label="Reportes" />
          <NavItem active={activeTab === 'monitor'} onClick={() => setActiveTab('monitor')} icon={<Clock size={18} />} label="Monitor" />
          <NavItem active={activeTab === 'recovery'} onClick={() => setActiveTab('recovery')} icon={<Zap size={18} />} label="Recuperación" />
          <NavItem active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<Truck size={18} />} label="Pedidos" count={orders.filter(o => o.status === 'pendiente').length} />
          <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box size={18} />} label="Inventario" />
          <NavItem active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings size={18} />} label="Configuración" />
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800 space-y-3">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-dark-accent/20 flex items-center justify-center border border-dark-accent/30 overflow-hidden shrink-0">
                  {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="avatar" /> : <User size={14} className="text-dark-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white truncate uppercase">{user.displayName || 'Parce'}</p>
                  <p className="text-[9px] text-neutral-500 truncate lowercase">Administrador</p>
                </div>
             </div>
             <button onClick={logout} className="w-full text-left text-neutral-500 hover:text-red-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-colors pl-1">
               <LogOut size={12} /> Salir
             </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto bg-black flex flex-col relative">
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-4 lg:px-8 bg-black/50 backdrop-blur-md sticky top-0 z-30 w-full shrink-0">
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
                <div className="flex items-center gap-2 px-3 py-1">
                  <Calendar size={12} className="text-dark-accent" />
                  <span className="text-[9px] font-black uppercase text-neutral-500">Desde:</span>
                </div>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-black text-[9px] text-white border-none outline-none p-1.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                />
                <span className="text-neutral-700 mx-1">|</span>
                <div className="flex items-center gap-2 px-3 py-1">
                  <span className="text-[9px] font-black uppercase text-neutral-500">Hasta:</span>
                </div>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-black text-[9px] text-white border-none outline-none p-1.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                    className="p-1 px-2 text-red-500 hover:text-red-400 transition-colors"
                    title="Limpiar filtros"
                  >
                    <Plus size={16} className="rotate-45" />
                  </button>
                )}
             </div>
             <div className="w-[1px] h-6 bg-neutral-800 hidden md:block mx-2" />
             <h2 className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] text-neutral-400">
               {activeTab === 'dashboard' && 'Visión General del Negocio'}
               {activeTab === 'crm' && 'CRM Pipeline de Clientes'}
               {activeTab === 'reports' && 'Reporte de Conversaciones'}
               {activeTab === 'monitor' && 'Monitor de Tiempo Real (Audit)'}
               {activeTab === 'recovery' && 'Activación de Ventas Abandonadas'}
               {activeTab === 'orders' && 'Ventana de Pedidos WhatsApp'}
               {activeTab === 'inventory' && 'Control de Stock Inteligente'}
               {activeTab === 'config' && 'Ajustes del Sistema'}
             </h2>
          </div>
          <div className="flex items-center gap-3">
             {/* 📱 PWA APP DOWNLOAD / INSTALL BUTTON */}
             <button
               onClick={handleInstallPWA}
               className="flex items-center gap-1.5 text-[9px] font-black uppercase bg-gradient-to-r from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer shrink-0"
               title="Instalar Jansel Shop AI como aplicación descargable en Celular o PC"
             >
               <Smartphone size={13} className="text-amber-400 animate-pulse shrink-0" />
               <span className="whitespace-nowrap">Instalar App</span>
             </button>

             {/* 🔔 NATIVE SYSTEM & VOICE NOTIFICATIONS CONTROL (WINDOWS / CELULAR / MAC) */}
             <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
               <button
                 onClick={async () => {
                   const granted = await requestNotificationPermission();
                   if (!nativeNotificationsEnabled) {
                     setNativeNotificationsEnabled(true);
                     playSoundAlert('order');
                     speakVoiceAlert("Sistema de notificaciones nativas y voz activado correctamente.");
                     toast.success("🔔 Notificaciones nativas de Windows/Celular y voz de IA activadas.");
                   } else {
                     setNativeNotificationsEnabled(false);
                     toast("🔕 Notificaciones nativas y voz desactivadas.");
                   }
                 }}
                 className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg transition-all ${
                   nativeNotificationsEnabled
                     ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                     : "bg-black text-neutral-500 border border-neutral-800 hover:text-white"
                 }`}
                 title="Activar o desactivar notificaciones de sistema Windows/Android con voz y sonido"
               >
                 {nativeNotificationsEnabled ? (
                   <Volume2 size={12} className="text-amber-400 animate-pulse shrink-0" />
                 ) : (
                   <VolumeX size={12} className="text-neutral-500 shrink-0" />
                 )}
                 <span className="whitespace-nowrap">{nativeNotificationsEnabled ? "Voz & Alertas ON" : "Voz & Alertas OFF"}</span>
               </button>

               {nativeNotificationsEnabled && (
                 <button
                   onClick={() => {
                     triggerNativeEventAlert({
                       title: "🛒 ¡Nuevo Pedido de Prueba!",
                       body: "Cliente: Carlos Vanegas - $149.900 COP",
                       voiceText: "¡Atención! Nuevo pedido de prueba recibido en Jansel Shop por un valor de 149.900 pesos.",
                       type: "order",
                       enabled: true
                     });
                     toast.success("📢 Notificación nativa y voz de prueba lanzadas.");
                   }}
                   className="p-1.5 text-[9px] font-bold text-neutral-400 hover:text-white bg-black hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors whitespace-nowrap"
                   title="Probar voz y notificación en Windows / Celular"
                 >
                   Probar
                 </button>
               )}
             </div>

             <button 
               onClick={async () => {
                 try {
                   const res = await fetch("/api/admin/test-notify", { method: "POST" });
                   if (res.ok) alert("✅ Mensaje de prueba enviado. Revisa tu WhatsApp parce.");
                   else alert("❌ Error. Asegúrate de haber puesto los números en los Secrets.");
                 } catch (e) {
                   alert("Error de conexión.");
                 }
               }}
               className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-dark-accent text-[9px] font-black uppercase text-neutral-400 hover:text-white px-4 py-2 rounded-xl transition-all"
             >
               <Bell size={12} />
               {userStore?.btnNotificationLabel || "Notificar Prueba"}
             </button>
             <div className="flex items-center gap-2 bg-dark-green/10 text-dark-green text-[9px] font-bold px-2 lg:px-3 py-1 rounded-full border border-dark-green/20 animate-pulse">
               <Zap size={10} /> <span className="hidden sm:inline">BOT ACTIVO</span>
             </div>
          </div>
        </header>

        {systemStatus?.twilioLimitReached && (
          <div className="bg-red-500 text-black px-4 py-3 flex items-center justify-between shadow-2xl relative z-40 border-b border-red-600">
            <div className="flex items-center gap-3">
              <AlertTriangle className="animate-bounce" size={18} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">⚠️ SISTEMA SUSPENDIDO: Límite de WhatsApp alcanzado</p>
                <p className="text-[9px] font-bold opacity-80 mt-1 uppercase">Twilio Trial restringe a 50 mensajes diarios. Se reseteará mañana automáticamente.</p>
              </div>
            </div>
            <button 
              onClick={() => updateDoc(doc(db, "config", "system"), { twilioLimitReached: false })}
              className="bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-colors"
            >
              Cerrar Aviso
            </button>
          </div>
        )}

        <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
           <AppErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                 {activeTab === 'dashboard' && <Dashboard key="dash" orders={filteredOrders} products={products} activities={filteredActivities} onShowReports={() => setActiveTab('reports')} onShowRecovery={() => setActiveTab('recovery')} />}
                 {activeTab === 'crm' && <CRMTab key="crm" customers={customers} selectedUser={selectedUser} onSelectUser={(phone: string) => { setSelectedUser(phone); setActiveTab('monitor'); }} />}
                 {activeTab === 'reports' && <ReportsTab key="reports" customers={customers} orders={orders}
                    activities={filteredActivities} 
                    conversations={conversations}
                    selectedUser={selectedUser}
                    setSelectedUser={setSelectedUser}
                    humanMessage={humanMessage}
                    setHumanMessage={setHumanMessage}
                    systemStatus={systemStatus}
                    userStore={userStore}
                  />}
                  {activeTab === 'monitor' && <MonitorTab key="monitor" activities={filteredActivities} />}
                 {activeTab === 'recovery' && <RecoveryTab 
                    key="recovery" 
                    activities={filteredActivities} 
                    onSelectUser={(phone: string) => {
                      setSelectedUser(phone);
                      setActiveTab('reports');
                    }}
                  />}
                 {activeTab === 'orders' && <OrdersTab key="orders" orders={filteredOrders} onUpdateStatus={updateOrderStatus} userStore={userStore} />}
                 {activeTab === 'inventory' && <InventoryTab key="inv" products={products} onUpdateStock={updateStock} onReset={resetDatabase} isResetting={isResetting} userStore={userStore} />}
                 {activeTab === 'config' && (
                   <ConfigTab 
                     key="config"
                     user={user}
                     userStore={userStore}
                     userStores={userStores}
                     setUserStore={setUserStore}
                     setUserStores={setUserStores}
                     webhookUrl={webhookUrl} 
                     copied={copied} 
                     onCopy={copyToClipboard} 
                     onClearTransactions={clearTransactions}
                     isClearing={isClearing}
                     apiKeyInput={apiKeyInput}
                     setApiKeyInput={setApiKeyInput}
                     configStatus={configStatus}
                     onReset={resetDatabase}
                     isResetting={isResetting}
                     onUpdateApiKey={async () => {
                       if (!apiKeyInput) return;
                       try {
                         const res = await fetch("/api/admin/config", {
                           method: "POST",
                           headers: { "Content-Type": "application/json" },
                           body: JSON.stringify({ apiKey: apiKeyInput })
                         });
                         const data = await res.json();
                         if (data.success) {
                           setConfigStatus({ type: 'success', message: "Cerebro actualizado." });
                           setApiKeyInput("");
                         }
                       } catch {
                         setConfigStatus({ type: 'error', message: "Error de red." });
                       }
                     }}
                   />
                 )}
              </AnimatePresence>
           </AppErrorBoundary>
        </div>
      </main>
    </div>
  );
}

/**
 * BACKGROUND AI AGENT
 * This component runs while the dashboard is open.
 * It listens for new WhatsApp messages and processes them via the AI cascade (NVIDIA / OpenRouter).
 */
function AIProcessor({ user }: { user: FirebaseUser }) {
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    console.log("[AI Agent] Monitoring processing status...");
    const q = query(
      collection(db, "activities"), 
      where("status", "==", "procesando"),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setProcessingCount(snapshot.docs.length);
      },
      (err) => {
        if (err.code === 'cancelled' || err.message?.includes('CANCELLED')) {
          console.debug("[AI Agent] Monitor stream cancelled");
        } else {
          console.error("[AI Agent] Monitor error:", err);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (processingCount === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] pointer-events-none">
      <div className="bg-neutral-900 border border-dark-accent/20 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-dark-accent/10 flex items-center justify-center border border-dark-accent/20">
            <Cpu className="w-5 h-5 text-dark-accent animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-dark-accent rounded-full flex items-center justify-center border-2 border-neutral-900">
            <span className="text-[8px] font-black text-black">{processingCount}</span>
          </div>
        </div>
        <div>
          <h4 className="text-white text-[10px] font-black uppercase tracking-widest">Jan Procesando...</h4>
          <p className="text-[9px] text-neutral-500">Auto-respuesta activa en el servidor.</p>
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: ReactNode, label: string, count?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative",
        active ? "bg-dark-accent text-black font-bold shadow-[0_4px_15px_rgba(242,125,38,0.3)]" : "hover:bg-neutral-800/50 text-neutral-500"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("transition-transform group-hover:scale-110", active ? "text-black" : "text-neutral-400")}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "text-[9px] px-1.5 py-0.5 rounded-md font-black transition-colors duration-200",
          active ? "bg-black/20 text-black" : "bg-dark-accent text-black"
        )}>
          {count}
        </span>
      )}
      {active && <motion.div layoutId="nav-glow" className="absolute inset-0 bg-white/10 rounded-xl pointer-events-none" />}
    </button>
  );
}

function Dashboard({ orders, products, activities, onShowReports, onShowRecovery }: { orders: Order[], products: Product[], activities: Activity[], onShowReports: () => void, onShowRecovery: () => void, key?: string }) {
  // Financial Calculations
  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
  
  const financialStats = orders.reduce((acc, order) => {
    const product = products.find(p => p.id === order.productId);
    const cost = (product?.cost || 0) * (order.quantity || 1);
    const freight = (product?.freight || 15000) * (order.quantity || 1);
    const profit = order.totalPrice - cost - freight;
    
    acc.totalCost += cost;
    acc.totalFreight += freight;
    acc.totalProfit += profit;
    return acc;
  }, { totalCost: 0, totalFreight: 0, totalProfit: 0 });

  const inventoryValue = products.reduce((acc, p) => acc + (p.cost || 0) * p.stock, 0);

  const stats = [
    { label: "Ventas Totales", value: orders.length, icon: <TrendingUp size={16} />, color: "text-blue-400" },
    { label: "Ingresos Brutos", value: `$${totalRevenue.toLocaleString()}`, icon: <DollarSign size={16} />, color: "text-white" },
    { label: "Ganancia Neta", value: `$${financialStats.totalProfit.toLocaleString()}`, icon: <Zap size={16} />, color: "text-dark-green" },
    { label: "Inversión Pend.", value: `$${inventoryValue.toLocaleString()}`, icon: <Box size={16} />, color: "text-dark-accent" }
  ];

  const financialMix = [
    { name: 'Costos Proveedor', value: financialStats.totalCost, color: '#333' },
    { name: 'Fletes/Envío', value: financialStats.totalFreight, color: '#444' },
    { name: 'Ganancia Real', value: financialStats.totalProfit, color: '#F27D26' }
  ];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return format(d, 'MMM d', { locale: es });
  }).reverse();

  const chartData = last7Days.map(day => {
    const count = orders.filter(o => {
      if (!o.createdAt) return false;
      try {
        const createdAtDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (!(createdAtDate instanceof Date) || isNaN(createdAtDate.getTime())) return false;
        return format(createdAtDate, 'MMM d', { locale: es }) === day;
      } catch (e) {
        return false;
      }
    }).length;
    return { name: day, ventas: count };
  });

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
      <div className="flex items-center justify-between mb-[-16px]">
         <div className="flex items-center gap-3">
            <div className="bg-dark-accent/10 border border-dark-accent/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-dark-green animate-pulse" />
               <span className="text-[9px] font-black uppercase text-dark-accent tracking-tighter">Instancia SaaS: Jan Vanegas HQ</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
               WhatsApp API: Conectado
            </div>
         </div>
         <div className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">Jan v3.1.2 SaaS Engine</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-[#111] border border-neutral-800 p-6 rounded-2xl flex items-center justify-between ring-1 ring-white/5 transition-all hover:border-neutral-700">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">{s.label}</p>
              <h4 className={cn("text-2xl font-serif italic", s.color)}>{s.value}</h4>
            </div>
            <div className={cn("p-3 rounded-xl bg-black/50 border border-neutral-800", s.color)}>{s.icon}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-dark-accent text-xs font-bold uppercase tracking-widest">Tendencia de Ventas (7 días)</h3>
              <span className="text-[10px] text-neutral-500">Actualizado en tiempo real</span>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#666' }} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#666' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', fontSize: '10px' }}
                  />
                  <Bar dataKey="ventas" fill="#F27D26" radius={[4, 4, 0, 0]} barSize={40}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5">
                <h3 className="text-dark-accent text-xs font-bold uppercase tracking-widest mb-6">Desglose Financiero</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-neutral-500 font-bold">Total Costos Prov.</span>
                    <span className="font-mono text-sm text-neutral-300">${financialStats.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-neutral-500 font-bold">Total Fletes</span>
                    <span className="font-mono text-sm text-neutral-300">${financialStats.totalFreight.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-dark-green/5 rounded-xl border border-dark-green/20">
                    <span className="text-[10px] uppercase text-dark-green font-black">Ganancia Real</span>
                    <span className="font-mono text-sm text-dark-green font-black">${financialStats.totalProfit.toLocaleString()}</span>
                  </div>
                </div>
             </div>
             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5 flex flex-col items-center justify-center">
                <div className="text-center space-y-1 mb-4">
                   <p className="text-[10px] uppercase text-neutral-500 font-bold">Eficiencia del Negocio</p>
                   <p className="text-2xl font-serif italic text-white">{((financialStats.totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}%</p>
                   <p className="text-[8px] text-white/40 uppercase font-black">Margen Promedio</p>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/5 mt-auto">
                   <div 
                    className="h-full bg-dark-accent transition-all duration-1000" 
                    style={{ width: `${(financialStats.totalProfit / (totalRevenue || 1)) * 100}%` }}
                   />
                </div>
             </div>

             <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111] border border-dark-accent/30 p-8 rounded-2xl ring-1 ring-white/5 relative overflow-hidden group flex flex-col justify-between">
                <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Zap size={100} className="text-dark-accent" />
                </div>
                <div className="relative z-10 space-y-2">
                   <div className="w-8 h-8 rounded-lg bg-dark-accent/20 flex items-center justify-center mb-4">
                      <History size={16} className="text-dark-accent" />
                   </div>
                   <h4 className="text-white font-serif italic text-xl leading-tight">Activación de Ventas</h4>
                   <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest leading-relaxed">Jan detectó 4 clientes en 'visto'. ¿Lanzar ráfaga de recuperación?</p>
                </div>
                <button 
                  onClick={onShowRecovery}
                  className="relative z-10 w-full mt-6 bg-dark-accent text-black py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors duration-300 shadow-lg shadow-dark-accent/10"
                >
                   Lanzar Jan Recuperador
                </button>
             </div>
          </div>
        </div>

        <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl flex flex-col ring-1 ring-white/5">
          <h3 className="text-dark-accent text-xs font-bold uppercase tracking-widest mb-6">Monitor Omnicanal (Vivo)</h3>
          <div className="space-y-4 flex-1">
             {activities.slice(0, 5).map((a) => (
               <div key={a.id} className="border-l-2 border-neutral-800 pl-4 py-1 space-y-1 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-neutral-500 font-mono">
                        {safeFormat(a.timestamp, 'HH:mm:ss')}
                      </span>
                      {a.platform === 'instagram' ? (
                        <Instagram size={10} className="text-pink-500" />
                      ) : a.platform === 'messenger' ? (
                        <MessageCircle size={10} className="text-blue-500" />
                      ) : (
                        <MessageSquare size={10} className="text-green-500" />
                      )}
                      <span className="text-[8px] text-dark-accent font-black uppercase tracking-tighter bg-dark-accent/10 px-1 rounded">
                        {(a.from || "unknown").slice(-4)}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[8px] uppercase font-black px-1.5 py-0.5 rounded-sm",
                      a.status === 'recibido' && 'bg-blue-900/40 text-blue-400',
                      a.status === 'procesando' && 'bg-yellow-900/40 text-yellow-500 animate-pulse',
                      a.status === 'respondido' && 'bg-dark-green/40 text-dark-green',
                      a.status === 'error' && 'bg-red-900/40 text-red-500'
                    )}>
                      {a.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-white font-medium truncate italic">"{a.message}"</p>
                  {a.response && (
                    <div className="flex items-start gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={10} className="mt-0.5" />
                      <p className="text-[9px] text-neutral-500 line-clamp-1">{a.response}</p>
                    </div>
                  )}
               </div>
             ))}
             {activities.length === 0 && <p className="text-[10px] text-neutral-600 italic">Sin actividad reciente.</p>}
          </div>
          <button 
            onClick={onShowReports}
            className="w-full py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-[10px] uppercase font-bold tracking-widest hover:bg-neutral-800 transition-colors mt-6"
          >
            Historial de Mensajes
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function canonicalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let clean = String(phone).toLowerCase()
    .replace(/whatsapp:/g, '')
    .replace(/instagram:/g, '')
    .replace(/messenger:/g, '')
    .trim();
  
  clean = clean.replace(/\D/g, '');
  if (!clean) return "";

  if (clean.length === 10 && clean.startsWith('3')) {
    clean = '57' + clean;
  }

  return `+${clean}`;
}

function ReportsTab({ 
  activities, 
  conversations,
  customers = [],
  orders = [],
  selectedUser, 
  setSelectedUser, 
  humanMessage, 
  setHumanMessage,
  systemStatus,
  userStore
}: { 
  activities: Activity[], 
  conversations: Record<string, any>,
  customers?: any[],
  orders?: any[],
  selectedUser: string | null, 
  setSelectedUser: (id: string | null) => void,
  humanMessage: string,
  setHumanMessage: (msg: string) => void,
  systemStatus: any,
  userStore: any,
  key?: string
}) {
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isIntervening, setIsIntervening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [platformFilter, setPlatformFilter] = useState<'all'|'whatsapp'|'instagram'|'messenger'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastSelectedUserRef = useRef<string | null>(null);

  // 📜 Historial completo del cliente que tienes abierto ahora mismo. El
  // listener global de "activities" trae solo los últimos 200 mensajes de
  // TODOS los clientes juntos (para que el panel no se sature), así que un
  // cliente con conversación larga podía perder mensajes viejos de vista.
  // Este estado aparte trae SU historial completo, sin ese límite global.
  const [selectedConvFullHistory, setSelectedConvFullHistory] = useState<Activity[]>([]);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedConvFullHistory([]);
      return;
    }
    const cleanPhone = canonicalizePhone(selectedUser).replace("+", "");
    if (!cleanPhone) return;

    const qFull = query(
      collection(db, "activities"),
      where("customerPhone", "==", cleanPhone),
      orderBy("timestamp", "asc"),
      limit(1000)
    );
    const unsubFull = onSnapshot(qFull,
      (snapshot: any) => {
        const docs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Activity));
        setSelectedConvFullHistory(docs);
      },
      (err: any) => {
        console.error("[Firestore] Error cargando historial completo del cliente:", err);
      }
    );
    return () => unsubFull();
  }, [selectedUser]);


  // ==============================================
  // 🧠 SCROLL INTELIGENTE (no más saltos molestos al subir)
  // ==============================================
  // Antes, CUALQUIER cambio en conversations/activities forzaba el scroll al
  // fondo, así estuvieras leyendo mensajes viejos arriba — muy molesto. Ahora:
  // 1) Al cambiar de cliente, bajamos al fondo UNA sola vez.
  // 2) Si llega un mensaje nuevo mientras ya estás al final, seguimos bajando
  //    suave para que veas lo nuevo.
  // 3) Si estás leyendo arriba, NO te movemos el scroll a la fuerza.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const switchedConversation = lastSelectedUserRef.current !== selectedUser;
    lastSelectedUserRef.current = selectedUser;

    if (switchedConversation) {
      // Nuevo cliente seleccionado: ir al fondo una sola vez (sin animación
      // para que no se sienta un scroll largo al abrir el chat).
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    // Mismo cliente, pero llegaron datos nuevos (mensaje nuevo, actualización
    // de estado, etc.): solo bajamos si el usuario ya estaba cerca del fondo.
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const wasNearBottom = distanceFromBottom < 150;
    if (wasNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations, selectedUser, activities]);

  const selectedCanonicalPhone = useMemo(() => {
    return canonicalizePhone(selectedUser);
  }, [selectedUser]);

  const selectedConversation = useMemo(() => {
    if (!selectedCanonicalPhone) return null;
    const digitsOnly = selectedCanonicalPhone.replace("+", "");
    return conversations[selectedCanonicalPhone] || conversations[digitsOnly] || conversations[`+${digitsOnly}`] || { aiPaused: false };
  }, [conversations, selectedCanonicalPhone]);

  const handleIntervention = async (agentName: string) => {
    if (!selectedUser || isIntervening) return;
    setIsIntervening(true);
    try {
      const res = await fetch("/api/whatsapp/intervene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedCanonicalPhone || selectedUser, agentName })
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error al intervenir: ${errorData.error || "Desconocido"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error de red al intervenir: ${e.message}`);
    } finally {
      setIsIntervening(false);
    }
  };

  const handleToggleAI = async (pause: boolean) => {
    if (!selectedUser) return;
    const targetPhone = selectedCanonicalPhone || selectedUser;
    console.log("[Toggle AI] Requesting:", { phone: targetPhone, pause });
    try {
      const res = await fetch("/api/whatsapp/toggle-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: targetPhone, pause })
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error al cambiar estado de IA: ${errorData.error || "Desconocido"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error de red al cambiar estado: ${e.message}`);
    }
  };

  // Build name resolution map across all available data sources
  const customerNameMap = useMemo(() => {
    const map: Record<string, string> = {};

    // 1. From customers array (CRM collection)
    if (Array.isArray(customers)) {
      customers.forEach(c => {
        const rawPhone = c.phone || c.telefono || c.id;
        const name = c.name || c.nombre || c.customerName;
        if (rawPhone && name && typeof name === 'string' && name.trim()) {
          const canon = canonicalizePhone(rawPhone);
          if (canon && canon !== name) {
            map[canon] = name.trim();
            map[canon.replace("+", "")] = name.trim();
          }
        }
      });
    }

    // 2. From orders array
    if (Array.isArray(orders)) {
      orders.forEach(o => {
        const rawPhone = o.customerPhone || o.phone || o.telefono;
        const name = o.customerName || o.nombre || o.nombreCliente || o.cliente;
        if (rawPhone && name && typeof name === 'string' && name.trim()) {
          const canon = canonicalizePhone(rawPhone);
          if (canon && canon !== name) {
            map[canon] = name.trim();
            map[canon.replace("+", "")] = name.trim();
          }
        }
      });
    }

    // 3. From conversations object
    if (conversations && typeof conversations === 'object') {
      Object.keys(conversations).forEach(key => {
        const conv = conversations[key];
        const name = conv?.customerName || conv?.profileName || conv?.name;
        if (name && typeof name === 'string' && name.trim()) {
          const canon = canonicalizePhone(key);
          if (canon) {
            map[canon] = name.trim();
            map[canon.replace("+", "")] = name.trim();
          }
        }
      });
    }

    return map;
  }, [customers, orders, conversations]);

  // Group activities by user (canonical phone number)
  const userConversations = useMemo(() => {
    // Combinamos el feed global (limitado a 200 para rendimiento) con el
    // historial completo del cliente actualmente abierto, para que ver un
    // chat específico nunca quede incompleto por el límite global.
    const combinedActivities = [...activities];
    const existingIds = new Set(activities.map(a => a.id));
    selectedConvFullHistory.forEach(a => {
      if (!existingIds.has(a.id)) combinedActivities.push(a);
    });

    return combinedActivities.reduce((acc, curr) => {
      let rawUser = 'unknown';
      const from = curr.from || "";
      const to = curr.to || "";
      const customerPhone = curr.customerPhone || "";
      const recipient = curr.recipient || "";
      const senderType = curr.senderType || "";

      const isBot = senderType === 'bot' || senderType === 'admin' || senderType === 'agent' || curr.status === "respondido" || !!curr.manualAgent || from.includes('14155238886') || from.includes('15072233213');

      if (isBot) {
        rawUser = customerPhone || recipient || to || "unknown";
      } else {
        rawUser = customerPhone || recipient || from || "unknown";
      }
      
      const userId = canonicalizePhone(rawUser);
      if (!userId || userId === 'unknown' || userId === '+') return acc;
      
      // Filter out bot's own numbers from appearing as customer chats
      const botNumbers = ['14155238886', '15072233213'];
      if (botNumbers.some(n => userId.includes(n))) return acc;

      if (!acc[userId]) {
        acc[userId] = {
          lastMessage: "",
          timestamp: curr.timestamp,
          platform: curr.platform || 'whatsapp',
          customerName: curr.customerName || null,
          pageId: undefined,
          messages: []
        };
      }

      // Avoid exact duplicate activity records if loaded twice
      const isDup = acc[userId].messages.some(m => m.id && curr.id && m.id === curr.id);
      if (!isDup) {
        acc[userId].messages.push(curr);
      }

      if (curr.customerName && !acc[userId].customerName) {
        acc[userId].customerName = curr.customerName;
      }
      
      return acc;
    }, {} as Record<string, { lastMessage: string, timestamp: any, platform: string, customerName?: string | null, pageId?: string, messages: Activity[] }>);
  }, [activities, selectedConvFullHistory]);

  // Post-process each conversation: sort messages chronologically and compute metadata
  const processedUserConversations = useMemo(() => {
    const result: Record<string, { lastMessage: string, timestamp: any, platform: string, customerName?: string | null, pageId?: string, messages: Activity[] }> = {};

    Object.keys(userConversations).forEach(userId => {
      const conv = userConversations[userId];
      const sortedMessages = [...conv.messages].sort((a, b) => {
        const timeA = (a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || a.createdAt).getTime())) || 0;
        const timeB = (b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || b.createdAt).getTime())) || 0;
        return timeA - timeB;
      });

      const lastMsg = sortedMessages[sortedMessages.length - 1];
      let lastText = "";
      if (lastMsg) {
        lastText = lastMsg.response || lastMsg.message || lastMsg.text || "";
        if (lastText.startsWith("[")) {
          const parts = lastText.split("]");
          if (parts.length > 1) lastText = parts.slice(1).join("]").trim();
        }
      }

      const incomingMsg = sortedMessages.find(m => m.senderType !== 'bot' && m.senderType !== 'admin' && m.senderType !== 'agent');

      const resolvedName = conv.customerName || customerNameMap[userId] || customerNameMap[userId.replace("+", "")] || null;
      
      const custDoc = customers.find(c => {
        const p = c.phone || c.id || "";
        return p.includes(userId.replace("+", "")) || userId.includes(p.replace(/\D/g, ""));
      });

      result[userId] = {
        ...conv,
        customerName: resolvedName,
        customerEtapa: custDoc?.etapa || 'interesado',
        aiPaused: custDoc?.aiPaused || false,
        messages: sortedMessages,
        lastMessage: lastText,
        timestamp: lastMsg?.timestamp || conv.timestamp,
        platform: lastMsg?.platform || conv.platform || 'whatsapp',
        pageId: incomingMsg?.to || conv.pageId
      };
    });

    // 👥 CLIENTES SIEMPRE VISIBLES: si un cliente existe en la base de datos
    // pero no tiene mensajes dentro de la ventana cargada (por ejemplo, no ha
    // escrito hace mucho), igual lo agregamos a la lista con una conversación
    // vacía, para que siempre lo puedas buscar y abrir para intervenir.
    customers.forEach(c => {
      const rawPhone = c.phone || c.id || "";
      if (!rawPhone) return;
      const userId = canonicalizePhone(rawPhone);
      if (!userId || userId === '+') return;
      const botNumbers = ['14155238886', '15072233213'];
      if (botNumbers.some(n => userId.includes(n))) return;

      if (!result[userId]) {
        result[userId] = {
          lastMessage: "(Sin mensajes recientes)",
          timestamp: c.lastInteractionAt || c.createdAt || null,
          platform: 'whatsapp',
          customerName: c.name || c.nombre || null,
          customerEtapa: c.etapa || 'interesado',
          aiPaused: c.aiPaused || false,
          messages: [],
          pageId: undefined
        } as any;
      }
    });

    return result;
  }, [userConversations, customerNameMap, customers]);

  const userIds = useMemo(() => {
    return Object.keys(processedUserConversations)
      .filter(uid => platformFilter === 'all' || processedUserConversations[uid].platform === platformFilter)
      .sort((a, b) => {
        const timeA = (processedUserConversations[a].timestamp?.toMillis ? processedUserConversations[a].timestamp.toMillis() : (processedUserConversations[a].timestamp instanceof Date ? processedUserConversations[a].timestamp.getTime() : new Date(processedUserConversations[a].timestamp).getTime())) || 0;
        const timeB = (processedUserConversations[b].timestamp?.toMillis ? processedUserConversations[b].timestamp.toMillis() : (processedUserConversations[b].timestamp instanceof Date ? processedUserConversations[b].timestamp.getTime() : new Date(processedUserConversations[b].timestamp).getTime())) || 0;
        return timeB - timeA;
      });
  }, [processedUserConversations, platformFilter]);

  const activeUserConv = useMemo(() => {
    if (!selectedCanonicalPhone) return null;
    return processedUserConversations[selectedCanonicalPhone] || null;
  }, [processedUserConversations, selectedCanonicalPhone]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;

    setIsUploading(true);
    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: await file.arrayBuffer()
      });
      const data = await response.json();
      if (data.success) {
        // Automatically send the media message
        await sendManualMessage("", data.url);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al subir archivo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendManualMessage = async (msg?: string, mediaUrl?: string) => {
    const messageToSend = msg !== undefined ? msg : humanMessage;
    if (!selectedUser || (!messageToSend.trim() && !mediaUrl) || isSending) return;

    if (systemStatus?.twilioLimitReached) {
      alert("⚠️ LÍMITE DE CUENTA: No puedes enviar más mensajes hoy debido al límite de Twilio Trial (50/día). Se reseteará automáticamente mañana.");
      return;
    }

    setIsSending(true);
    try {
      // Auto-pause AI if human intervenes
      if (!selectedConversation?.aiPaused) {
        handleToggleAI(true);
      }
      
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           to: selectedUser, 
           message: messageToSend, 
           mediaUrl,
           platform: selectedConversation?.platform,
           pageId: selectedConversation?.pageId || undefined
        })
      });
      
      if (res.ok) {
        if (msg === undefined) setHumanMessage("");
      } else {
        const data = await res.json();
        if (res.status === 429 || data.limitReached) {
          alert("⚠️ LÍMITE ALCANZADO: Tu cuenta de Twilio Trial ha superado los 50 mensajes diarios. Jan no puede enviar más mensajes por hoy. Por favor, espera 24h o actualiza tu cuenta de Twilio.");
        } else {
          alert(`Error: ${data.error || "No se pudo enviar el mensaje."}`);
        }
      }
    } catch (e) {
      console.error("Manual send error:", e);
    } finally {
      setIsSending(false);
    }
  };

  const [showStatusId, setShowStatusId] = useState<string | null>(null);

  const renderMedia = (text: string) => {
    const matches = [...text.matchAll(/\[Media:\s*(https?:\/\/[^\]]+)\]/g)];
    if (matches.length === 0) return null;
    
    return (
      <div className="flex flex-col gap-2 mt-2">
        {matches.map((match, idx) => {
          const url = match[1];
          const isVideo = url.match(/\.(mp4|webm)/i);
          const isAudio = url.match(/\.(mp3|wav|m4a|aac|ogg|opus)/i) || url.toLowerCase().includes('audio') || (url.includes('/api/media/') && url.endsWith('.mp3'));
          const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)/i) || url.toLowerCase().includes('image') || url.includes('/api/image-proxy');
          
          if (isVideo) {
            return (
              <video 
                key={idx} 
                src={url} 
                controls 
                className="rounded-lg max-w-full border border-white/10 max-h-64" 
              />
            );
          }
          if (isAudio) {
            return (
              <audio 
                key={idx} 
                src={url} 
                controls 
                className="w-full" 
              />
            );
          }
          if (isImage) {
            return (
              <img 
                key={idx} 
                src={url} 
                referrerPolicy="no-referrer" 
                alt="Media" 
                className="rounded-lg max-w-full h-auto border border-white/5 max-h-64 object-contain" 
              />
            );
          }
          return (
            <a 
              key={idx} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-amber-400 underline flex items-center gap-1 hover:text-white"
            >
              📎 Ver archivo adjunto ({url.split('/').pop()?.split('?')[0] || "Descargar"})
            </a>
          );
        })}
      </div>
    );
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-140px)] lg:h-[calc(100vh-180px)] bg-[#111] border border-neutral-800 rounded-3xl overflow-hidden flex flex-col md:flex-row ring-1 ring-white/5 shadow-2xl relative">
      {/* Sidebar: User List */}
      <div className={cn(
        "w-full md:w-80 border-r border-neutral-800 flex flex-col bg-[#0d0d0d] absolute inset-0 md:relative z-10 transition-transform duration-300 md:translate-x-0",
        selectedUser ? "-translate-x-full md:translate-x-0" : "translate-x-0"
      )}>
        <div className="p-4 border-b border-neutral-800 flex flex-col gap-4">
          <h3 className="text-dark-accent text-[10px] font-black uppercase tracking-[0.2em]">Clientes Activos</h3>
          <div className="flex bg-neutral-900 rounded-lg p-1">
            <button
              onClick={() => setPlatformFilter('all')}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all",
                platformFilter === 'all' ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-white"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setPlatformFilter('whatsapp')}
              className={cn(
                "flex-1 py-1.5 flex justify-center items-center rounded-md transition-all",
                platformFilter === 'whatsapp' ? "bg-[#25D366]/20 text-[#25D366] shadow-sm" : "text-neutral-500 hover:text-[#25D366]"
              )}
            >
              <MessageSquare size={14} />
            </button>
            <button
              onClick={() => setPlatformFilter('instagram')}
              className={cn(
                "flex-1 py-1.5 flex justify-center items-center rounded-md transition-all",
                platformFilter === 'instagram' ? "bg-[#E1306C]/20 text-[#E1306C] shadow-sm" : "text-neutral-500 hover:text-[#E1306C]"
              )}
            >
              <Instagram size={14} />
            </button>
            <button
              onClick={() => setPlatformFilter('messenger')}
              className={cn(
                "flex-1 py-1.5 flex justify-center items-center rounded-md transition-all",
                platformFilter === 'messenger' ? "bg-[#0084FF]/20 text-[#0084FF] shadow-sm" : "text-neutral-500 hover:text-[#0084FF]"
              )}
            >
              <MessageCircle size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {userIds.map(uid => {
            const conv = processedUserConversations[uid];
            const isSelected = selectedCanonicalPhone === uid;

            return (
              <button
                key={uid}
                onClick={() => setSelectedUser(uid)}
                className={cn(
                  "w-full p-4 flex items-center gap-4 transition-all border-b border-neutral-900/50 group text-left",
                  isSelected ? "bg-dark-accent/10 border-l-4 border-l-dark-accent" : "hover:bg-white/5"
                )}
              >
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center border border-neutral-800 shrink-0 group-hover:border-dark-accent/30 transition-colors">
                  {conv.platform === 'instagram' ? (
                    <Instagram size={20} className={cn(isSelected ? "text-pink-500" : "text-neutral-600")} />
                  ) : conv.platform === 'messenger' ? (
                    <MessageCircle size={20} className={cn(isSelected ? "text-blue-500" : "text-neutral-600")} />
                  ) : (
                    <MessageSquare size={20} className={cn(isSelected ? "text-green-500" : "text-neutral-600")} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    {conv.customerName ? (
                      <div className="min-w-0 flex-1 pr-2">
                        <p className={cn("text-xs font-black truncate uppercase", isSelected ? "text-dark-accent" : "text-white")}>
                          {conv.customerName}
                        </p>
                        <p className="text-[9px] text-neutral-500 font-mono truncate">
                          {uid}
                        </p>
                      </div>
                    ) : (
                      <p className={cn("text-xs font-black truncate uppercase font-mono", isSelected ? "text-dark-accent" : "text-white")}>
                        {uid}
                      </p>
                    )}
                    <span className="text-[8px] text-neutral-600 font-mono shrink-0 ml-1">
                      {safeFormat(conv.timestamp, 'HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[10px] text-neutral-500 truncate italic flex-1">
                      "{conv.lastMessage}"
                    </p>
                    {((conv as any).customerEtapa === 'comprado' || (conv as any).customerEtapa === 'finalizado') ? (
                      <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                        ✓ Compró
                      </span>
                    ) : ((conv as any).customerEtapa === 'asesoria_solicitada' || (conv as any).aiPaused) ? (
                      <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                        ⏸ Humano
                      </span>
                    ) : (conv as any).customerEtapa === 'checkout' ? (
                      <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        🛒 Checkout
                      </span>
                    ) : (
                      <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full bg-neutral-900 text-neutral-500 border border-neutral-800 shrink-0">
                        Explorando
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {userIds.length === 0 && (
            <div className="p-12 text-center opacity-30">
              <MessageSquare size={32} className="mx-auto mb-2" />
              <p className="text-[10px] uppercase font-bold tracking-widest">Sin chats</p>
            </div>
          )}
        </div>
      </div>

      {/* Main: Chat View */}
      <div className={cn(
        "flex-1 flex flex-col bg-black/40 relative h-full transition-transform duration-300 md:translate-x-0",
        selectedUser ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/20 backdrop-blur-sm gap-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedUser(null)}
                      className="p-2 md:hidden text-neutral-500 hover:text-white"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-dark-accent/10 flex items-center justify-center border border-dark-accent/20">
                      {activeUserConv?.platform === 'instagram' ? (
                        <Instagram size={16} className="text-pink-500" />
                      ) : activeUserConv?.platform === 'messenger' ? (
                        <MessageCircle size={16} className="text-blue-500" />
                      ) : (
                        <MessageSquare size={16} className="text-green-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {activeUserConv?.customerName ? (
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-sm font-bold text-white uppercase">
                              {activeUserConv.customerName}
                            </h4>
                            <span className="text-xs font-mono text-neutral-400">
                              ({selectedCanonicalPhone})
                            </span>
                          </div>
                        ) : (
                          <h4 className="text-sm font-bold text-white font-mono">
                            {selectedCanonicalPhone}
                          </h4>
                        )}
                        {selectedConversation?.aiPaused && (
                          <span className="bg-red-500/10 text-red-500 text-[7px] font-black px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-widest animate-pulse">
                            IA Pausada
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-dark-green uppercase font-bold tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-dark-green rounded-full animate-pulse" /> <span className="hidden xs:inline">{activeUserConv?.platform || 'WhatsApp'}</span> Activo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleToggleAI(!selectedConversation?.aiPaused)}
                      className={cn(
                        "text-[9px] font-black px-6 py-3 rounded-xl border transition-all active:scale-95 flex items-center gap-3 shadow-lg uppercase tracking-wider",
                        selectedConversation?.aiPaused 
                          ? "bg-dark-green text-black border-dark-green hover:bg-dark-green/90 shadow-dark-green/40 shadow-lg" 
                          : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-black shadow-red-500/10"
                      )}
                    >
                      {selectedConversation?.aiPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                      {selectedConversation?.aiPaused ? "REANUDAR IA (BOT ACTIVO)" : "PAUSAR IA (INTERVENCIÓN MANUAL)"}
                    </button>
                  </div>
                </div>

                <div className="px-4 py-2 border-b border-neutral-800 bg-black/40 flex items-center gap-4 overflow-x-auto no-scrollbar">
                  <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest shrink-0">Atajos Rápidos:</span>
                  <button 
                    onClick={() => sendManualMessage(userStore?.btnQuick1Message || "¡Patrón! Si paga ya por transferencia se libera de los $25.000 de seguro que cobra la transportadora por el contra-entrega. ¡No pierda esa plata y sea cliente VIP con despacho hoy mismo!")} 
                    className="whitespace-nowrap text-[7px] font-black uppercase tracking-tighter bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-md hover:border-dark-accent transition-all flex items-center gap-1.5 grow-0 shrink-0"
                  >
                    <DollarSign size={8} className="text-green-500" /> {userStore?.btnQuick1Label || "Beneficio"}
                  </button>
                  <button 
                    onClick={() => sendManualMessage(userStore?.btnQuick2Message || "¡Rey! Se me acabaron de llevar el penúltimo. Solo me queda UNO con su nombre. ¿Se lo separo ya mismo o se lo paso al siguiente?")} 
                    className="whitespace-nowrap text-[7px] font-black uppercase tracking-tighter bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-md hover:border-dark-accent transition-all flex items-center gap-1.5 grow-0 shrink-0"
                  >
                    <AlertTriangle size={8} className="text-orange-500" /> {userStore?.btnQuick2Label || "Cierre"}
                  </button>
                  <button 
                    onClick={() => sendManualMessage(userStore?.btnQuick3Message || "¡Buenas! El repartidor ya está cargando el camión VIP. Si transfiere ahorita, su pedido sale de primero. ¿Hacemos el negocio ya para que le llegue mañana?")} 
                    className="whitespace-nowrap text-[7px] font-black uppercase tracking-tighter bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-md hover:border-dark-accent transition-all flex items-center gap-1.5 grow-0 shrink-0"
                  >
                    <Truck size={8} className="text-blue-500" /> {userStore?.btnQuick3Label || "Prioridad"}
                  </button>
                </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col gap-6 custom-scrollbar">
              {(() => {
                if (!activeUserConv || !activeUserConv.messages) return null;
                const currentPlatform = activeUserConv.platform || 'whatsapp';
                const isInstagram = currentPlatform === 'instagram';
                const isMessenger = currentPlatform === 'messenger';

                // Deduplicate and process messages into clean visual bubbles
                const bubbles: Array<{
                  id: string;
                  type: 'user' | 'bot';
                  text: string;
                  timestamp: any;
                  whatsappStatus?: string;
                  manualAgent?: string;
                }> = [];

                activeUserConv.messages.forEach((msg, idx) => {
                  const isBotOrAdmin = msg.senderType === 'bot' || msg.senderType === 'admin' || msg.senderType === 'agent' || !!msg.manualAgent || msg.from?.includes('14155238886') || msg.from?.includes('15072233213');
                  const hasUserMsg = !isBotOrAdmin && msg.message && !msg.message.startsWith('📱 Notificación');

                  if (hasUserMsg) {
                    const uText = (msg.message || "").trim();
                    const isDup = bubbles.slice(-5).some(b => b.type === 'user' && b.text.toLowerCase() === uText.toLowerCase());
                    if (!isDup && uText) {
                      bubbles.push({
                        id: `u_${msg.id || idx}`,
                        type: 'user',
                        text: uText,
                        timestamp: msg.timestamp || msg.createdAt
                      });
                    }
                  }

                  let botText = "";
                  if (msg.response) {
                    botText = msg.response;
                  } else if (isBotOrAdmin && msg.message) {
                    botText = msg.message;
                  } else if (msg.text && (isBotOrAdmin || msg.type === 'status_notification')) {
                    botText = msg.text;
                  }

                  if (botText) {
                    const bText = botText.trim();
                    const isDup = bubbles.slice(-5).some(b => b.type === 'bot' && b.text.toLowerCase() === bText.toLowerCase());
                    if (!isDup && bText) {
                      bubbles.push({
                        id: `b_${msg.id || idx}`,
                        type: 'bot',
                        text: bText,
                        timestamp: msg.respondedAt || msg.timestamp || msg.createdAt,
                        whatsappStatus: msg.whatsappStatus,
                        manualAgent: msg.manualAgent || (msg.message === '[Asesor Humano]' ? 'Asesor Humano' : undefined),
                        buttons: msg.buttons || undefined
                      });
                    }
                  }
                });

                return bubbles.map((b) => (
                  <div key={b.id} className="space-y-4">
                    {/* User Bubble */}
                    {b.type === 'user' && (
                      <div className="flex items-start gap-4 max-w-[85%]">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                          isInstagram ? "bg-gradient-to-tr from-[#fd5949] to-[#d6249f] border-pink-500/20" :
                          isMessenger ? "bg-gradient-to-tr from-[#00c6ff] to-[#0072ff] border-blue-500/20" :
                          "bg-neutral-900 border-neutral-800"
                        )}>
                          {isInstagram ? <Instagram size={14} className="text-white" /> :
                           isMessenger ? <MessageCircle size={14} className="text-white" /> :
                           <User size={14} className="text-neutral-600" />}
                        </div>
                        <div>
                          <div className={cn(
                            "p-4 rounded-2xl rounded-tl-none text-white text-[13px] leading-relaxed shadow-lg border",
                            isInstagram ? "bg-black border-pink-900/30" :
                            isMessenger ? "bg-black border-blue-900/30" :
                            "bg-neutral-900 border-neutral-800"
                          )}>
                            <span>{b.text.split(" [Media:")[0]}</span>
                            {renderMedia(b.text)}
                          </div>
                          <p className="text-[9px] text-neutral-600 mt-2 font-mono uppercase">
                            {safeFormat(b.timestamp, 'HH:mm:ss')} • {currentPlatform}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bot Bubble */}
                    {b.type === 'bot' && (
                      <div className="flex items-start gap-4 max-w-[85%] ml-auto flex-row-reverse">
                        <div className={cn(
                          "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                          b.manualAgent ? "bg-dark-accent/20 border-dark-accent/30" : 
                          isInstagram ? "bg-pink-600/20 border-pink-500/30" :
                          isMessenger ? "bg-blue-600/20 border-blue-500/30" :
                          "bg-dark-green/10 border-dark-green/20"
                        )}>
                          {b.manualAgent ? <User size={14} className="text-dark-accent" /> : <Cpu size={14} className={cn(isInstagram ? "text-pink-500" : isMessenger ? "text-blue-500" : "text-dark-green")} />}
                        </div>
                        <div className="text-right">
                          <div 
                            className={cn(
                              "p-4 rounded-2xl rounded-tr-none text-[13px] leading-relaxed shadow-xl border cursor-pointer select-none",
                              b.manualAgent 
                                ? "bg-dark-accent text-white border-dark-accent" 
                                : isInstagram ? "bg-gradient-to-r from-[#d6249f]/10 to-[#fd5949]/10 border-pink-500/30 text-white font-medium italic"
                                : isMessenger ? "bg-gradient-to-r from-[#0072ff]/10 to-[#00c6ff]/10 border-blue-500/30 text-white font-medium italic"
                                : "bg-neutral-800 text-neutral-200 border-neutral-700 font-medium italic"
                            )}
                            onClick={() => setShowStatusId(showStatusId === b.id ? null : b.id)}
                          >
                            <div className="flex items-center justify-between mb-1 opacity-50 text-[8px] font-black uppercase tracking-widest gap-2">
                              <span>{b.manualAgent || "Jan AI"}</span>
                              {b.manualAgent && <span className="flex items-center gap-1"><User size={8}/> Manual</span>}
                            </div>
                            <span>{b.text.split(" [Media:")[0]}</span>
                            {renderMedia(b.text)}

                            {/* 🔘 Botones interactivos, tal cual los ve el cliente en WhatsApp */}
                            {b.buttons && b.buttons.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                                {b.buttons.map((label: string, bi: number) => (
                                  <button
                                    key={bi}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      alert(`Este botón fue enviado al cliente: "${label}"\n\nEs una réplica visual de lo que ve en su WhatsApp.`);
                                    }}
                                    className="w-full text-center text-[12px] font-semibold text-blue-400 bg-black/30 hover:bg-black/50 rounded-lg py-2 px-3 transition-colors not-italic"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 mt-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
                                {b.whatsappStatus === 'read' ? (
                                  <>
                                    <span className="text-[7px] font-black text-blue-400 uppercase tracking-tighter">Visto</span>
                                    <CheckCheck size={10} className="text-blue-500" />
                                  </>
                                ) : b.whatsappStatus === 'delivered' ? (
                                  <>
                                    <span className="text-[7px] font-black text-neutral-400 uppercase tracking-tighter">Entregado</span>
                                    <CheckCheck size={10} className="text-neutral-500" />
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[7px] font-black text-neutral-500 uppercase tracking-tighter">Enviado</span>
                                    <Check size={10} className="text-neutral-500" />
                                  </>
                                )}
                              </div>
                              <p className="text-[9px] text-neutral-600 font-mono uppercase">
                                {b.manualAgent ? "Intervención Manual" : "Jan AI Response"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ));
              })()}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-neutral-800 bg-black/40 backdrop-blur-md">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*,video/*,audio/*"
              />
              <div className="flex items-center gap-4 bg-neutral-900/50 p-2 pl-4 rounded-2xl border border-neutral-800 focus-within:border-dark-accent transition-all ring-1 ring-white/5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 text-neutral-500 hover:text-dark-accent transition-colors disabled:opacity-30"
                >
                  {isUploading ? <RefreshCw className="animate-spin" size={18} /> : <Paperclip size={18} />}
                </button>
                <input
                  type="text"
                  placeholder="Intervenir como asesor humano..."
                  value={humanMessage}
                  onChange={(e) => setHumanMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendManualMessage()}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white py-2"
                />
                <button
                  onClick={() => sendManualMessage()}
                  disabled={!humanMessage.trim() || isSending}
                  className="bg-dark-accent hover:bg-dark-accent/90 text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-tighter transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
                >
                  {isSending ? <RefreshCw className="animate-spin" size={12} /> : <Zap size={12} />}
                  {isSending ? "Enviando..." : "Enviar Ahora"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4 opacity-40">
            <div className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-serif italic text-white uppercase tracking-tighter">Selecciona una conversación</h3>
            <p className="text-[11px] text-neutral-500 uppercase tracking-widest font-bold max-w-xs">Toca un cliente en la lista para monitorear el chat de Jan o intervenir manualmente.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function OrdersTab({ orders, onUpdateStatus, userStore }: { orders: Order[], onUpdateStatus: (id: string, s: Order['status'], notifyCustomer?: boolean) => void, userStore?: any, key?: string }) {
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);

  // States for AI Post-Purchase Cross-Sell VIP system
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [generatingUpsellId, setGeneratingUpsellId] = useState<string | null>(null);
  const [sendingUpsellId, setSendingUpsellId] = useState<string | null>(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");

  // Selected Order for Master-Detail Layout
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Normalize phone number for universal wa.me link
  const normalizePhone = (phone: string) => {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      cleaned = "57" + cleaned; // Default to Colombia if 10 digits
    }
    return cleaned;
  };

  // Filtered list of orders
  const filteredList = useMemo(() => {
    return orders.filter(o => {
      const name = o.customerName || "";
      const phone = o.customerPhone || "";
      const product = o.productName || "";
      const city = o.city || "";
      const address = o.address || "";
      
      const matchesSearch = 
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.includes(searchTerm) ||
        product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        address.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesStatus = statusFilter === "todas" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Active Order based on selection
  const activeOrder = useMemo(() => {
    const selected = filteredList.find(o => o.id === selectedOrderId);
    if (selected) return selected;
    return filteredList[0] || null;
  }, [filteredList, selectedOrderId]);

  // Handle active selection synchronization
  useEffect(() => {
    if (filteredList.length > 0) {
      if (!selectedOrderId || !filteredList.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(filteredList[0].id);
      }
    }
  }, [filteredList, selectedOrderId]);

  const handlePushToPlatform = async (orderId: string, platform: 'shopify' | 'dropi') => {
    setSyncingOrderId(orderId + '_' + platform);
    try {
      const res = await fetch(`/api/integration/${platform}/push-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, storeId: userStore?.id || 'default' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (e: any) {
      toast.error("Error de red: " + e.message);
    } finally {
      setSyncingOrderId(null);
    }
  };

  const downloadCSV = () => {
    if (orders.length === 0) return;
    
    // Headers for Dropi (typical format)
    const headers = ["Fecha", "Cliente", "Telefono", "Producto", "Unidades", "Direccion", "Indicacion", "Ciudad", "Total", "Status"];
    const rows = orders.map(o => [
      safeFormat(o.createdAt, 'yyyy-MM-dd HH:mm'),
      o.customerName,
      o.customerPhone,
      o.productName,
      o.quantity,
      o.address,
      o.addressIndicator || "N/A",
      o.city,
      o.totalPrice,
      o.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pedidos_jan_vanegas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-900/40 p-4 rounded-2xl border border-neutral-850">
        <div>
          <h3 className="text-dark-accent text-[12px] font-black uppercase tracking-[0.2em] leading-none mb-1">Ventana de Pedidos</h3>
          <p className="text-[10px] text-neutral-400">Gestiona, integra y despacha los pedidos capturados por el chatbot.</p>
        </div>
        <button 
          onClick={downloadCSV}
          disabled={orders.length === 0}
          className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 disabled:opacity-30 self-stretch sm:self-auto justify-center"
        >
          <Database size={12} className="text-dark-accent" />
          Descargar para Dropi (CSV)
        </button>
      </div>

      {/* MASTER-DETAIL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: LIST OF ORDERS */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* SEARCH & FILTER CONTROLS */}
          <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-2.5 rounded-xl border border-neutral-850">
            <div className="col-span-2 relative flex items-center">
              <Search size={12} className="absolute left-3 text-neutral-500" />
              <input 
                type="text"
                placeholder="Buscar cliente, ciudad o producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111] border border-neutral-800 rounded-lg pl-8 pr-2.5 py-1.5 text-[10px] text-white outline-none focus:border-dark-accent placeholder-neutral-500 font-sans"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#111] border border-neutral-800 rounded-lg p-1.5 text-[10px] text-neutral-300 font-black uppercase outline-none cursor-pointer focus:border-dark-accent"
            >
              <option value="todas">TODOS</option>
              <option value="pendiente">PENDIENTES</option>
              <option value="confirmado">CONFIRMADOS</option>
              <option value="despachado">DESPACHADOS</option>
              <option value="entregado">ENTREGADOS</option>
              <option value="cancelado">CANCELADOS</option>
            </select>
          </div>

          {/* LIST CONTAINER */}
          <div className="flex flex-col gap-3 max-h-[700px] overflow-y-auto pr-1 no-scrollbar">
            {filteredList.map((o) => {
              const isActive = o.id === activeOrder?.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all duration-200 outline-none relative overflow-hidden flex flex-col gap-2.5",
                    isActive 
                      ? "bg-neutral-900 border-[#F27D26]/60 shadow-lg shadow-black/40 ring-1 ring-[#F27D26]/20" 
                      : "bg-[#111]/80 border-neutral-800 hover:bg-neutral-900/50 hover:border-neutral-700"
                  )}
                >
                  {/* Left accent color bar if active */}
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F27D26]" />}

                  {/* Top Status & Date Row */}
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-neutral-500 font-mono">
                      {safeFormat(o.createdAt, 'dd MMM, HH:mm')}
                    </span>
                    <span className={cn(
                      "font-black tracking-widest uppercase px-2 py-0.5 rounded-full text-[8px] border",
                      o.status === 'pendiente' ? 'text-amber-400 bg-amber-500/5 border-amber-500/25' :
                      o.status === 'confirmado' ? 'text-cyan-400 bg-cyan-500/5 border-cyan-500/25' :
                      o.status === 'despachado' ? 'text-blue-400 bg-blue-500/5 border-blue-500/25' :
                      o.status === 'entregado' ? 'text-green-400 bg-green-500/5 border-green-500/25' :
                      'text-rose-400 bg-rose-500/5 border-rose-500/25'
                    )}>
                      {o.status}
                    </span>
                  </div>

                  {/* Customer Name & Source Badger */}
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-tight leading-tight flex items-center gap-1.5 flex-wrap break-words">
                      <span className="break-words">{o.customerName}</span>
                      {(o as any).origin === 'landing' && (
                        <span className="text-[7.5px] bg-amber-500/15 text-amber-400 border border-amber-500/20 font-black px-1.5 py-0.2 rounded uppercase tracking-widest leading-none">
                          Landing ⚡
                        </span>
                      )}
                    </h4>
                  </div>

                  {/* Product purchased */}
                  <div className="text-[10px] text-neutral-400 font-sans line-clamp-1">
                    📦 {o.productName} <span className="text-neutral-500 font-bold">(x{o.quantity})</span>
                  </div>

                  {/* Bottom Metadata & Price Row */}
                  <div className="flex justify-between items-center text-[9.5px] border-t border-neutral-800/40 pt-2.5 mt-0.5">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <MapPin size={9} />
                      {o.city}
                    </span>
                    <span className="font-mono text-dark-green font-bold text-xs">
                      ${o.totalPrice?.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredList.length === 0 && (
              <div className="p-12 text-center bg-[#111] border border-neutral-800 rounded-xl space-y-2">
                <ShoppingBag className="mx-auto text-neutral-800 w-10 h-10" />
                <p className="text-neutral-500 text-[10px] uppercase font-bold">No se encontraron pedidos</p>
                <p className="text-neutral-600 text-[9px]">Prueba con otro término de búsqueda.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CURRENT ORDER DETAILS (WORKSPACE) */}
        <div className="lg:col-span-7">
          {activeOrder ? (
            <div className="bg-[#111] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
              {/* HEADER DETAILS PANEL */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-neutral-800/80">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold font-serif text-white uppercase tracking-tight leading-none">
                      {activeOrder.customerName}
                    </h2>
                    {activeOrder.status === 'pendiente' && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-400">
                    <span className="font-mono text-neutral-500">ID: {activeOrder.id.slice(0, 8)}...</span>
                    <span>•</span>
                    <span className="text-neutral-500">{safeFormat(activeOrder.createdAt, 'dd MMMM yyyy, HH:mm')}</span>
                    <span>•</span>
                    <span className="text-amber-500 font-bold">
                      {activeOrder.origin === 'landing' ? 'Landing Page ⚡' : 'WhatsApp Chatbot 🤖'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
                  {/* Status Dropdown */}
                  <select 
                    value={activeOrder.status}
                    onChange={(e) => onUpdateStatus(activeOrder.id, e.target.value as any, true)}
                    className={cn(
                      "bg-black border border-neutral-800 rounded-xl px-3 py-2 text-[10px] uppercase font-black outline-none cursor-pointer hover:border-dark-accent transition-colors",
                      activeOrder.status === 'pendiente' ? 'text-amber-400 border-amber-500/40' : 
                      activeOrder.status === 'confirmado' ? 'text-cyan-400 border-cyan-500/40' : 
                      activeOrder.status === 'despachado' ? 'text-blue-400 border-blue-500/40' : 
                      activeOrder.status === 'entregado' ? 'text-green-400 border-green-500/40' : 
                      'text-rose-400 border-rose-500/40'
                    )}
                  >
                    <option value="pendiente">⏳ Pendiente</option>
                    <option value="confirmado">✅ Confirmado</option>
                    <option value="despachado">🚚 Despachado</option>
                    <option value="entregado">🎉 Entregado</option>
                    <option value="cancelado">❌ Cancelado</option>
                  </select>

                  {/* Direct Request Confirmation with Quick Action Buttons */}
                  <button
                    onClick={async () => {
                      try {
                        toast.loading("Enviando plantilla de confirmación con botones a WhatsApp...", { id: "req_conf_" + activeOrder.id });
                        const res = await fetch("/api/admin/request-order-confirmation", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ orderId: activeOrder.id })
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success("¡Botones de confirmación enviados al cliente por WhatsApp!", { id: "req_conf_" + activeOrder.id });
                        } else {
                          toast.error("Error: " + (data.error || "No se pudo enviar"), { id: "req_conf_" + activeOrder.id });
                        }
                      } catch (e: any) {
                        toast.error("Error: " + e.message, { id: "req_conf_" + activeOrder.id });
                      }
                    }}
                    title="Enviar plantilla interactiva de confirmación con botones rápido a WhatsApp"
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10 active:scale-95"
                  >
                    <CheckCircle size={12} className="text-amber-400 shrink-0" />
                    Enviar Botones Confirmación
                  </button>

                  {/* Re-notify WhatsApp Button */}
                  <button
                    onClick={() => onUpdateStatus(activeOrder.id, activeOrder.status, true)}
                    title="Notificar por WhatsApp este estado al cliente"
                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                  >
                    <MessageSquare size={10} />
                    Notificar WA
                  </button>

                  {/* Direct Contact Button */}
                  <a 
                    href={`https://wa.me/${normalizePhone(activeOrder.customerPhone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600/10 hover:bg-emerald-600/20 text-green-400 border border-emerald-500/20 px-2.5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                  >
                    <Phone size={10} />
                    Chat
                  </a>
                </div>
              </div>

              {/* PRODUCTS LIST */}
              <div className="bg-neutral-950/60 rounded-xl p-4 border border-neutral-850 space-y-3">
                <h5 className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Productos Solicitados</h5>
                <div className="flex justify-between items-center text-[11px] border-b border-neutral-800/40 pb-2">
                  <span className="text-neutral-200 font-medium">
                    📦 {activeOrder.productName}
                  </span>
                  <span className="text-neutral-400 font-bold">
                    x{activeOrder.quantity}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider">Total del Pedido</span>
                  <span className="font-mono text-dark-green text-sm font-black select-all">
                    ${activeOrder.totalPrice?.toLocaleString()} COP
                  </span>
                </div>
              </div>

              {/* DELIVERY DATA */}
              <div className="bg-neutral-950/60 rounded-xl p-4 border border-neutral-850 space-y-4">
                <h5 className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Datos de Entrega</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10.5px]">
                  <div>
                    <span className="text-neutral-500 block uppercase text-[8px] tracking-wider mb-1">Nombre de Contacto</span>
                    <span className="text-white font-bold">{activeOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase text-[8px] tracking-wider mb-1">Número de Contacto</span>
                    <span className="text-white font-bold select-all">{activeOrder.customerPhone}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-neutral-500 block uppercase text-[8px] tracking-wider mb-1">Dirección de Destino</span>
                    <span className="text-white font-bold leading-relaxed">{activeOrder.address}, {activeOrder.city}</span>
                  </div>
                  {activeOrder.addressIndicator && (
                    <div className="md:col-span-2 bg-neutral-900/30 p-2.5 rounded border border-neutral-850/60 italic text-neutral-300">
                      <span className="text-neutral-500 not-italic block uppercase text-[7.5px] font-bold tracking-wider mb-0.5">Indicaciones de Dirección</span>
                      Ref: {activeOrder.addressIndicator}
                    </div>
                  )}
                  {(activeOrder as any).notes && (
                    <div className="md:col-span-2 bg-amber-500/5 p-2.5 rounded border border-amber-500/10 text-amber-300/90 whitespace-pre-wrap leading-tight">
                      <span className="text-amber-500 block uppercase text-[7.5px] font-bold tracking-wider mb-0.5">Datos Extra Recolectados</span>
                      {(activeOrder as any).notes}
                    </div>
                  )}
                </div>
              </div>

              {/* INTEGRATIONS SYNC (SHOPIFY & DROPI) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SHOPIFY CARD */}
                <div className="bg-neutral-950/40 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h6 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Tienda Shopify</h6>
                      <p className="text-[8px] text-neutral-500 mt-0.5">Sincronización de pedidos</p>
                    </div>
                    {(activeOrder as any).shopifyStatus === 'enviado' ? (
                      <span className="text-[8px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20" title={`Shopify ID: ${(activeOrder as any).shopifyOrderId}`}>
                        ✓ ENVIADO
                      </span>
                    ) : (activeOrder as any).shopifyStatus === 'error' ? (
                      <span className="text-[8px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20" title={(activeOrder as any).shopifyError}>
                        ⚠️ ERROR
                      </span>
                    ) : (
                      <span className="text-[8px] text-neutral-500 font-bold bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
                        PENDIENTE
                      </span>
                    )}
                  </div>
                  
                  {/* Push Action */}
                  <button 
                    onClick={() => handlePushToPlatform(activeOrder.id, 'shopify')}
                    disabled={syncingOrderId === `${activeOrder.id}_shopify` || (activeOrder as any).shopifyStatus === 'enviado'}
                    className="w-full bg-neutral-850 hover:bg-neutral-800 disabled:opacity-45 text-neutral-200 hover:text-white font-bold text-[9px] uppercase py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-neutral-800"
                  >
                    <Send size={10} className={syncingOrderId === `${activeOrder.id}_shopify` ? "animate-spin" : ""} />
                    {syncingOrderId === `${activeOrder.id}_shopify` ? "Procesando..." : 
                     (activeOrder as any).shopifyStatus === 'enviado' ? "Sincronizado" : "Enviar a Shopify"}
                  </button>
                </div>

                {/* DROPI CARD */}
                <div className="bg-neutral-950/40 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h6 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Transportadora Dropi</h6>
                      <p className="text-[8px] text-neutral-500 mt-0.5">Generación de guía de despacho</p>
                    </div>
                    {(activeOrder as any).dropiStatus === 'enviado' ? (
                      <span className="text-[8px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20" title={`Dropi Carrier: ${(activeOrder as any).dropiCarrier}`}>
                        ✓ DESPACHADO
                      </span>
                    ) : (activeOrder as any).dropiStatus === 'error' ? (
                      <span className="text-[8px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20" title={(activeOrder as any).dropiError}>
                        ⚠️ ERROR
                      </span>
                    ) : (
                      <span className="text-[8px] text-neutral-500 font-bold bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
                        PENDIENTE
                      </span>
                    )}
                  </div>

                  {/* Dispatch Guide output if sent */}
                  {(activeOrder as any).dropiTrackingNumber && (
                    <div className="bg-black/35 p-2 rounded border border-neutral-850 font-mono text-[8px] leading-tight flex justify-between items-center select-all">
                      <span className="text-neutral-500 uppercase">Guía:</span>
                      <span className="text-white font-bold">{(activeOrder as any).dropiTrackingNumber}</span>
                    </div>
                  )}
                  
                  {/* Push Action */}
                  <button 
                    onClick={() => handlePushToPlatform(activeOrder.id, 'dropi')}
                    disabled={syncingOrderId === `${activeOrder.id}_dropi` || (activeOrder as any).dropiStatus === 'enviado'}
                    className="w-full bg-neutral-850 hover:bg-neutral-800 disabled:opacity-45 text-neutral-200 hover:text-white font-bold text-[9px] uppercase py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-neutral-800"
                  >
                    <Send size={10} className={syncingOrderId === `${activeOrder.id}_dropi` ? "animate-spin" : ""} />
                    {syncingOrderId === `${activeOrder.id}_dropi` ? "Procesando..." : 
                     (activeOrder as any).dropiStatus === 'enviado' ? "Generar Guía" : "Enviar a Dropi"}
                  </button>
                </div>
              </div>

              {/* DETAILED TRACKING LOGISTICS SYSTEM */}
              <div className="bg-neutral-950/50 border border-neutral-850 p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                  <h6 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Seguimiento Logístico Automatizado</h6>
                  {(activeOrder as any).trackingUrl && (
                    <button 
                      onClick={async () => {
                        if (confirm("¿Seguro que quieres remover el enlace de seguimiento?")) {
                          try {
                            toast.loading("Restableciendo...", { id: "track_reset" });
                            const res = await fetch(`/api/integration/orders/${activeOrder.id}/tracking`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ trackingUrl: "" })
                            });
                            const data = await res.json();
                            if (data.success) {
                              toast.success("Enlace restablecido.", { id: "track_reset" });
                            } else {
                              toast.error(data.error, { id: "track_reset" });
                            }
                          } catch (err: any) {
                            toast.error(err.message, { id: "track_reset" });
                          }
                        }
                      }}
                      className="text-red-500 hover:text-red-400 text-[8px] underline"
                    >
                      Remover Ruta
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Setup Tracking Link */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-mono text-neutral-500 uppercase font-bold">Ruta de Seguimiento (URL)</span>
                    {(activeOrder as any).trackingUrl ? (
                      <a 
                        href={(activeOrder as any).trackingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[9px] text-blue-400 font-bold hover:underline block truncate max-w-full bg-blue-500/5 p-2 rounded border border-blue-500/10"
                        title={(activeOrder as any).trackingUrl}
                      >
                        🔗 Ver Ruta de Rastreo Oficial
                      </a>
                    ) : (
                      <div className="flex gap-1.5">
                        <input 
                          type="text"
                          placeholder="Pegar URL de seguimiento..."
                          className="bg-black/45 border border-neutral-800 text-[9px] text-white px-3 py-1.5 rounded-lg outline-none w-full focus:border-dark-accent"
                          id={`tracking_url_${activeOrder.id}`}
                        />
                        <button
                          onClick={async () => {
                            const input = document.getElementById(`tracking_url_${activeOrder.id}`) as HTMLInputElement;
                            if (!input || !input.value.trim()) {
                              toast.error("Por favor pega la URL de ruta de Dropi o transportadora.");
                              return;
                            }
                            try {
                              toast.loading("Configurando...", { id: "track_save_" + activeOrder.id });
                              const res = await fetch(`/api/integration/orders/${activeOrder.id}/tracking`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ trackingUrl: input.value.trim() })
                              });
                              const data = await res.json();
                              if (data.success) {
                                toast.success("¡Ruta guardada y cliente notificado!", { id: "track_save_" + activeOrder.id });
                                input.value = "";
                              } else {
                                toast.error("Error: " + data.error, { id: "track_save_" + activeOrder.id });
                              }
                            } catch (e: any) {
                              toast.error("Error: " + e.message, { id: "track_save_" + activeOrder.id });
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] px-3 rounded-lg uppercase"
                        >
                          Guardar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Escaneo IA trigger */}
                  {(activeOrder as any).trackingUrl ? (
                    <div className="flex flex-col justify-end">
                      <button
                        onClick={async () => {
                          try {
                            toast.loading("Escaneando ruta en tiempo real con IA...", { id: "track_scan_" + activeOrder.id });
                            const res = await fetch(`/api/integration/orders/${activeOrder.id}/tracking/scan`, {
                              method: "POST"
                            });
                            const data = await res.json();
                            if (data.success) {
                              toast.success(`Ruta escaneada: Estado: ${data.status.toUpperCase()}`, { id: "track_scan_" + activeOrder.id });
                            } else {
                              toast.error("Error: " + data.error, { id: "track_scan_" + activeOrder.id });
                            }
                          } catch (e: any) {
                            toast.error("Error: " + e.message, { id: "track_scan_" + activeOrder.id });
                          }
                        }}
                        className="bg-neutral-850 hover:bg-neutral-800 text-neutral-200 hover:text-white text-[9px] font-black uppercase py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 font-mono border border-neutral-750"
                      >
                        <RefreshCw size={10} />
                        Escaneo IA Inmediato
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center text-[8.5px] text-neutral-500 italic leading-snug">
                      La IA monitoreará y enviará notificaciones por WhatsApp al cliente cuando asocies la URL de seguimiento.
                    </div>
                  )}

                  {/* Monitored metrics */}
                  {(activeOrder as any).trackingUrl && (
                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/25 p-3 rounded-lg border border-neutral-850 text-[10px]">
                      <div className="space-y-0.5">
                        <span className="text-neutral-500 block text-[7.5px] uppercase font-bold tracking-wider">Estado Logística</span>
                        <span className={cn(
                          "font-bold uppercase",
                          (activeOrder as any).trackingStatus === "entregado" ? "text-green-400" :
                          (activeOrder as any).trackingStatus === "novedad" ? "text-red-400" :
                          (activeOrder as any).trackingStatus === "en_ruta" ? "text-blue-400" : "text-amber-400"
                        )}>
                          {(activeOrder as any).trackingStatus === "preparacion" ? "En preparación" : 
                           (activeOrder as any).trackingStatus === "en_ruta" ? "En tránsito" : 
                           (activeOrder as any).trackingStatus === "entregado" ? "Entregado" : 
                           (activeOrder as any).trackingStatus === "novedad" ? "Novedad / Retorno" : "En preparación"}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-neutral-500 block text-[7.5px] uppercase font-bold tracking-wider">Transportista</span>
                        <span className="text-neutral-300 font-bold">{(activeOrder as any).trackingCarrier || "Pendiente"}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-neutral-500 block text-[7.5px] uppercase font-bold tracking-wider">Guía oficial</span>
                        <span className="text-neutral-300 font-mono font-bold select-all">{(activeOrder as any).trackingGuide || "-"}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-neutral-500 block text-[7.5px] uppercase font-bold tracking-wider">Último chequeo</span>
                        <span className="text-neutral-400 font-mono text-[9px]">
                          {(activeOrder as any).lastTrackedAt ? new Date((activeOrder as any).lastTrackedAt).toLocaleString() : "Pendiente"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Active/Pause toggling */}
                  {(activeOrder as any).trackingUrl && (
                    <div className="md:col-span-2 flex items-center justify-between bg-black/10 border border-neutral-850 p-2.5 rounded-lg text-[9.5px]">
                      <span className="text-neutral-400">Notificaciones automáticas en tiempo real:</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-white font-bold">
                          <input 
                            type="radio" 
                            name={`monitoring_${activeOrder.id}`} 
                            checked={!(activeOrder as any).trackingPaused}
                            onChange={async () => {
                              try {
                                toast.loading("Activando monitoreo...", { id: "track_mon_" + activeOrder.id });
                                const res = await fetch(`/api/integration/orders/${activeOrder.id}/tracking/toggle-monitoring`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ paused: false })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  toast.success("Monitoreo activo.", { id: "track_mon_" + activeOrder.id });
                                } else {
                                  toast.error(data.error, { id: "track_mon_" + activeOrder.id });
                                }
                              } catch (err: any) {
                                toast.error(err.message, { id: "track_mon_" + activeOrder.id });
                              }
                            }}
                            className="accent-emerald-500 cursor-pointer"
                          />
                          <span>Activo</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-neutral-400 hover:text-white transition-colors">
                          <input 
                            type="radio" 
                            name={`monitoring_${activeOrder.id}`} 
                            checked={!!(activeOrder as any).trackingPaused}
                            onChange={async () => {
                              try {
                                toast.loading("Pausando monitoreo...", { id: "track_mon_" + activeOrder.id });
                                const res = await fetch(`/api/integration/orders/${activeOrder.id}/tracking/toggle-monitoring`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ paused: true })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  toast.success("Monitoreo pausado.", { id: "track_mon_" + activeOrder.id });
                                } else {
                                  toast.error(data.error, { id: "track_mon_" + activeOrder.id });
                                }
                              } catch (err: any) {
                                toast.error(err.message, { id: "track_mon_" + activeOrder.id });
                              }
                            }}
                            className="accent-amber-500 cursor-pointer"
                          />
                          <span>Pausado</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 🛍️ AI POST-PURCHASE MARKETING & CROSS-SELL (COSMIC STYLE CARD) */}
              <div className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border border-amber-500/25 p-5 rounded-2xl ring-1 ring-amber-500/10 space-y-4">
                <div className="flex justify-between items-center border-b border-amber-500/10 pb-3">
                  <h6 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-500 animate-pulse" />
                    <span>Inteligencia Artificial - Cross-Selling</span>
                  </h6>
                  
                  {/* Automatic flow status toggle */}
                  <button
                    onClick={async () => {
                      const newPaused = !(activeOrder as any).upsellPaused;
                      try {
                        toast.loading(newPaused ? "Pausando..." : "Activando...", { id: "upsell_pause_" + activeOrder.id });
                        await updateDoc(doc(db, "orders", activeOrder.id), { upsellPaused: newPaused });
                        toast.success(newPaused ? "Campaña marketing pausada" : "Flujo automático activo", { id: "upsell_pause_" + activeOrder.id });
                      } catch (err: any) {
                        toast.error(err.message, { id: "upsell_pause_" + activeOrder.id });
                      }
                    }}
                    className={cn(
                      "text-[8px] px-2.5 py-1 rounded-lg font-bold uppercase transition-all tracking-wider border",
                      (activeOrder as any).upsellPaused 
                        ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" 
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                    )}
                    title={(activeOrder as any).upsellPaused ? "Activar flujo automático de 7 a 15 días" : "Pausar flujo de fidelización"}
                  >
                    {(activeOrder as any).upsellPaused ? "Campaña Pausada" : "Campaña Automática Activa"}
                  </button>
                </div>

                {!(activeOrder as any).upsellProfile ? (
                  <div className="flex flex-col gap-3 py-2 items-center text-center max-w-sm mx-auto">
                    <Sparkles className="text-amber-500/50 w-8 h-8" />
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      El cerebro del agente analizará el comportamiento de este cliente para deducir sus preferencias y generar una oferta VIP hiper-personalizada.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          setGeneratingUpsellId(activeOrder.id);
                          toast.loading("IA analizando y aprendiendo del cliente...", { id: "upsell_gen_" + activeOrder.id });
                          const res = await fetch(`/api/integration/orders/${activeOrder.id}/generate-upsell`, {
                            method: "POST"
                          });
                          const data = await res.json();
                          if (data.success) {
                            toast.success("¡Análisis y recomendación listos!", { id: "upsell_gen_" + activeOrder.id });
                          } else {
                            toast.error("Error: " + data.error, { id: "upsell_gen_" + activeOrder.id });
                          }
                        } catch (err: any) {
                          toast.error("Error: " + err.message, { id: "upsell_gen_" + activeOrder.id });
                        } finally {
                          setGeneratingUpsellId(null);
                        }
                      }}
                      disabled={generatingUpsellId === activeOrder.id}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-[9px] uppercase py-2.5 px-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                    >
                      {generatingUpsellId === activeOrder.id ? "Analizando..." : "✨ GENERAR OFERTA INTELIGENTE"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 text-left">
                    {/* IA Deduction block */}
                    <div className="bg-[#121212] p-3 rounded-xl border border-neutral-850">
                      <span className="text-[7.5px] font-mono text-neutral-500 block uppercase font-bold tracking-wider mb-1">Deducción de Perfil (IA)</span>
                      <p className="text-[10px] text-neutral-300 italic leading-snug">
                        "{(activeOrder as any).upsellProfile}"
                      </p>
                    </div>

                    {/* Recommended Product */}
                    <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/15 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[7.5px] font-mono text-amber-500 block uppercase font-bold tracking-wider">Producto Recomendado</span>
                        <span className="text-[11px] font-black text-amber-400">
                          🎁 {(activeOrder as any).upsellRecommendedProductName}
                        </span>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        VIP Offer
                      </span>
                    </div>

                    {/* Editable textarea suggested msg */}
                    <div className="space-y-1.5">
                      <span className="text-[8px] font-mono text-neutral-500 uppercase font-bold tracking-wider block">Mensaje de Oferta Sugerido (Editable)</span>
                      <textarea
                        value={editedMessages[activeOrder.id] !== undefined ? editedMessages[activeOrder.id] : ((activeOrder as any).upsellSuggestedMsg || "")}
                        onChange={(e) => {
                          setEditedMessages({
                            ...editedMessages,
                            [activeOrder.id]: e.target.value
                          });
                        }}
                        className="w-full bg-black/60 border border-neutral-800 text-[10px] text-neutral-100 p-3 rounded-xl outline-none h-28 resize-none font-sans leading-relaxed focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
                      />
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex gap-2">
                        {/* REGEN BUTTON */}
                        <button
                          onClick={async () => {
                            try {
                              setGeneratingUpsellId(activeOrder.id);
                              toast.loading("IA re-analizando recomendación...", { id: "upsell_gen_" + activeOrder.id });
                              const res = await fetch(`/api/integration/orders/${activeOrder.id}/generate-upsell`, {
                                method: "POST"
                              });
                              const data = await res.json();
                              if (data.success) {
                                toast.success("¡Recomendación actualizada!", { id: "upsell_gen_" + activeOrder.id });
                                // Clear edited buffer
                                const nextEdited = { ...editedMessages };
                                delete nextEdited[activeOrder.id];
                                setEditedMessages(nextEdited);
                              } else {
                                toast.error("Error: " + data.error, { id: "upsell_gen_" + activeOrder.id });
                              }
                            } catch (err: any) {
                              toast.error("Error: " + err.message, { id: "upsell_gen_" + activeOrder.id });
                            } finally {
                              setGeneratingUpsellId(null);
                            }
                          }}
                          disabled={generatingUpsellId === activeOrder.id}
                          className="w-1/3 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold text-[9px] uppercase py-2.5 rounded-xl transition-all text-center flex items-center justify-center gap-1 border border-neutral-700"
                          title="Re-calcular recomendación con IA"
                        >
                          <RefreshCw size={10} className={generatingUpsellId === activeOrder.id ? "animate-spin" : ""} />
                          RE-GENERA
                        </button>

                        {/* SEND VIP BUTTON (DIRECT INSTANT WHATSAPP SEND + DATABASE UPDATE) */}
                        <button
                          onClick={async () => {
                            const currentMsg = editedMessages[activeOrder.id] !== undefined ? editedMessages[activeOrder.id] : ((activeOrder as any).upsellSuggestedMsg || "");

                            try {
                              setSendingUpsellId(activeOrder.id);
                              toast.loading("Enviando WhatsApp corporativo...", { id: "upsell_send_" + activeOrder.id });
                              const res = await fetch(`/api/integration/orders/${activeOrder.id}/send-upsell`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ customMessage: currentMsg })
                              });
                              const data = await res.json();
                              if (data.success) {
                                toast.success("¡Oferta VIP enviada correctamente por WhatsApp!", { id: "upsell_send_" + activeOrder.id });
                              } else {
                                toast.error("Error: " + data.error, { id: "upsell_send_" + activeOrder.id });
                              }
                            } catch (err: any) {
                              toast.error("Error: " + err.message, { id: "upsell_send_" + activeOrder.id });
                            } finally {
                              setSendingUpsellId(null);
                            }
                          }}
                          disabled={sendingUpsellId === activeOrder.id}
                          className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase py-2.5 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/15"
                        >
                          {sendingUpsellId === activeOrder.id ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <Send size={10} />
                          )}
                          Enviar WhatsApp VIP
                        </button>
                      </div>

                      {/* Status indicator tracking */}
                      <div className="flex justify-between items-center text-[8px] font-mono border-t border-neutral-850 pt-2.5">
                        <span className="text-neutral-500">Log de Envío:</span>
                        {(activeOrder as any).upsellSent ? (
                          <span className="text-green-400 font-bold uppercase flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                            <CheckCircle size={8} /> ENVIADO
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold uppercase flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <Clock size={8} /> PENDIENTE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#111] border border-neutral-800 rounded-2xl p-12 text-center space-y-4 min-h-[400px] flex flex-col justify-center items-center">
              <ShoppingBag className="text-neutral-700 w-12 h-12" />
              <h4 className="text-sm font-black text-white uppercase tracking-widest">Sin Selección</h4>
              <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                Selecciona un pedido del listado izquierdo para inspeccionar su dirección de despacho, sincronizar plataformas y enviar ofertas cruzadas con IA.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InventoryTab({ products, onUpdateStock, onReset, isResetting, userStore }: { products: Product[], onUpdateStock: (id: string, s: number) => void, onReset: (storeId?: string) => void, isResetting: boolean, userStore: any, key?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("todas");
  const [showManualLoad, setShowManualLoad] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [loadingManual, setLoadingManual] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const handleManualLoad = async () => {
    if (!manualJson) return;
    if (!confirm("⚠️ ATENCIÓN: esto REEMPLAZA TODO el catálogo actual por el JSON que pegaste (borra los productos existentes que no estén en este JSON). ¿Seguro que quieres continuar?")) return;
    setLoadingManual(true);
    try {
      const catalog = JSON.parse(manualJson);
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog, storeId: userStore?.id || "default" })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("✅ Catálogo actualizado con éxito.");
        setShowManualLoad(false);
        setManualJson("");
      } else {
        toast.error("❌ Error: " + data.error);
      }
    } catch (e: any) {
      toast.error("❌ JSON Inválido: " + e.message);
    } finally {
      setLoadingManual(false);
    }
  };

  const handleManualLoadBulk = async (catalog: any[]) => {
    setLoadingManual(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog: { products: catalog }, storeId: userStore?.id || "default" })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("✅ Producto agregado con éxito.");
      } else {
        toast.error("❌ Error: " + data.error);
      }
    } catch (e: any) {
      toast.error("❌ Error: " + e.message);
    } finally {
      setLoadingManual(false);
    }
  };

  const categories = ["todas", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const handleImageUpload = async (p: Product, file: File) => {
    if (!file || !p.docId) return;
    
    setUploadingDocId(p.docId);
    const toastId = toast.loading(`Subiendo imagen para ${p.name}...`);
    
    // Timeout for upload to avoid immortal spinners
    const uploadTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout de subida")), 15000)
    );

    try {
      const targetId = p.docId;
      const storageRef = ref(storage, `products/${targetId}`);
      
      console.log(`[Inventory] Uploading image for ${targetId}...`);
      
      const uploadTask = uploadBytes(storageRef, file);
      const snapshot = await Promise.race([uploadTask, uploadTimeout]) as any;
      const url = await getDownloadURL(snapshot.ref);
      
      console.log(`[Inventory] Download URL: ${url}`);
      
      await updateDoc(doc(db, "products", targetId), { 
        imageUrl: url,
        updatedAt: serverTimestamp() 
      });
      
      console.log(`[Inventory] Firestore updated for ${targetId}`);
      toast.success("¡Imagen actualizada con éxito!", { id: toastId });
    } catch (err: any) {
      console.error("Error uploading image:", err);
      toast.error(`Error al subir imagen: ${err.message || 'Error desconocido'}`, { id: toastId });
    } finally {
      setUploadingDocId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "todas" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-4">
        <div>
          <h3 className="text-dark-accent text-[11px] font-black uppercase tracking-[0.2em] mb-1 leading-none">Control de Inventario Pro</h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Base de datos sincronizada vía Firebase</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
             <input 
               type="text" 
               placeholder="Buscar producto..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-[11px] text-white focus:outline-none focus:border-dark-accent transition-colors"
             />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 overflow-x-auto max-w-[300px] no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] uppercase font-black transition-all whitespace-nowrap",
                  activeCategory === cat ? "bg-dark-accent text-black" : "text-neutral-500 hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowManualLoad(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] font-black rounded-xl hover:bg-neutral-800 hover:text-white transition-all whitespace-nowrap"
          >
            <Database size={14} /> CARGA MANUAL
          </button>

          <button 
            onClick={() => onReset(userStore?.id || "default")}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] font-black rounded-xl hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw size={14} className={cn(isResetting && "animate-spin")} /> <span>{isResetting ? "CARGANDO..." : "SINCRONIZAR"}</span>
          </button>

          <button 
            onClick={async () => {
              const confirmInfo = prompt("Nombre del nuevo producto:");
              if (!confirmInfo) return;
              const price = prompt("Precio del producto (solo números):", "50000");
              if (!price) return;
              const category = prompt("Categoría (ej: Tecnología, Hogar, Autos):", "General") || "General";

              try {
                const res = await fetch("/api/admin/products/add-trending", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: confirmInfo,
                    price: parseInt(price),
                    category,
                    storeId: userStore?.id || "default"
                  })
                });
                const data = await res.json();
                if (data.success) {
                  toast.success("✅ Producto agregado. La IA ya está armando la campaña de tendencia para clientes antiguos.");
                } else {
                  toast.error("❌ Error: " + data.error);
                }
              } catch (e: any) {
                toast.error("❌ Error: " + e.message);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-dark-accent text-black text-[10px] font-black rounded-xl hover:scale-105 transition-all shadow-[0_4px_15px_rgba(242,125,38,0.2)] whitespace-nowrap"
          >
            <Plus size={14} /> NUEVO
          </button>
        </div>
      </div>
      
      {/* Active Store Indicator */}
      <div className="bg-neutral-900/50 border border-neutral-800 p-3 rounded-xl flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-dark-accent animate-pulse" />
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
              Gestionando inventario de: <span className="text-white">{userStore?.name || "Global"}</span>
            </p>
         </div>
         <p className="text-[10px] text-neutral-500 font-mono">{userStore?.id}</p>
      </div>

      {/* Manual Load Modal */}
      <AnimatePresence>
        {showManualLoad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualLoad(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-dark-accent font-black uppercase text-xs tracking-widest">Carga Manual de Catálogo</h3>
                  <p className="text-[10px] text-neutral-500 mt-1">Pega el JSON de productos. 🔴 IMPORTANTE: Para vincular un producto con Dropi añade el campo <strong className="text-white">"dropiProductId": "ID_DE_DROPI"</strong> y para la foto añade <strong className="text-white">"imageUrl": "https://enlace..."</strong>.</p>
                </div>
                <button onClick={() => setShowManualLoad(false)} className="text-neutral-500 hover:text-white">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <textarea 
                value={manualJson}
                onChange={(e) => setManualJson(e.target.value)}
                placeholder='{ "products": [ { "id": "prod1", "name": "...", "price": 1000, "imageUrl": "https://..." } ] }'
                className="w-full h-80 bg-black border border-neutral-800 rounded-2xl p-6 font-mono text-[11px] text-neutral-400 focus:outline-none focus:border-dark-accent transition-all leading-relaxed no-scrollbar"
              />

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleManualLoad}
                  disabled={loadingManual || !manualJson}
                  className="flex-1 bg-dark-accent text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 shadow-xl shadow-dark-accent/10"
                >
                  {loadingManual ? "PROCESANDO..." : "ACTUALIZAR BASE DE DATOS"}
                </button>
                <button 
                  onClick={() => {
                    const template = { products: [{ id: "ejemplo-1", category: "autos", name: "Producto de Ejemplo", description: "Descripción...", cost: 10000, freight: 5000, price: 25000, stock: 10, currency: "COP", dropiProductId: "123456" }] };
                    setManualJson(JSON.stringify(template, null, 2));
                  }}
                  className="bg-neutral-800 text-neutral-400 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-700 transition-all"
                >
                  CARGAR PLANTILLA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-[#111] border border-neutral-800 rounded-2xl overflow-hidden ring-1 ring-white/5">
        <div className="overflow-x-auto no-scrollbar text-[11px]">
          <table className="w-full text-left min-w-[900px] lg:min-w-0">
             <thead className="bg-neutral-900 border-b border-neutral-800">
               <tr className="font-serif italic text-dark-accent">
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Producto</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Categoría</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Proveedor</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Precio Venta</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Stock Actual</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Estatus</th>
                  <th className="p-5 uppercase tracking-tighter text-[10px]">Costo Prov.</th>
                  <th className="p-5 uppercase tracking-tighter text-[10px]">Flete</th>
                  <th className="p-5 uppercase tracking-tighter text-[10px] text-dark-accent">Ganancia</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-neutral-800">
                {filteredProducts.map((p) => (
                  <tr key={p.docId || p.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center border border-white/5 text-neutral-500 overflow-hidden group-hover:border-dark-accent/30 transition-all">
                           {p.imageUrl ? 
                              <img 
                                src={getProxiedImageUrl(p.imageUrl)} 
                                alt={p.name} 
                                referrerPolicy="no-referrer" 
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  if (!target.src.endsWith('/images/logo.jpeg')) {
                                    target.src = '/images/logo.jpeg';
                                  }
                                }}
                                className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-110", uploadingDocId === p.docId && "opacity-20 blur-[2px]")} 
                              /> :
                              <Box size={16} />
                           }
                           {uploadingDocId === p.docId && (
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                               <RefreshCw size={14} className="text-dark-accent animate-spin" />
                             </div>
                           )}
                        </div>
                        <div>
                          <p className="font-bold text-white uppercase whitespace-nowrap text-[11px] group-hover:text-dark-accent transition-colors">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <label className={cn(
                              "cursor-pointer text-[9px] font-black uppercase transition-all flex items-center gap-1",
                              uploadingDocId === p.docId ? "text-neutral-600 pointer-events-none" : "text-dark-accent hover:text-white"
                            )}>
                              {uploadingDocId === p.docId ? (
                                <>
                                  <RefreshCw size={10} className="animate-spin" />
                                  SUBIENDO...
                                </>
                              ) : (
                                <>
                                  <ImageIcon size={10} />
                                  CAMBIAR FOTO
                                </>
                              )}
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                disabled={uploadingDocId !== null}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(p, file);
                                  e.target.value = ''; // Reset input
                                }} 
                              />
                            </label>
                            <span className="text-[9px] text-neutral-700">|</span>
                            <span className="text-[9px] text-neutral-600 font-mono">{p.id}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-widest">{p.category || 'N/A'}</span>
                    </td>
                    <td className="p-5 text-neutral-500 uppercase">{p.provider || 'Dropi'}</td>
                    <td className="p-5 font-mono text-dark-green font-bold text-sm">${p.price.toLocaleString()}</td>
                    <td className="p-5">
                       <div className="flex items-center gap-4">
                          <button 
                            onClick={() => onUpdateStock(p.docId!, p.stock - 1)}
                            className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 active:scale-90 text-white transition-all font-bold"
                          >-</button>
                          <span className={cn("font-bold text-lg min-w-[2ch] text-center", p.stock < 5 ? 'text-red-400' : 'text-white')}>
                            {p.stock}
                          </span>
                          <button 
                            onClick={() => onUpdateStock(p.docId!, p.stock + 1)}
                            className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 active:scale-90 text-white transition-all font-bold"
                          >+</button>
                       </div>
                    </td>
                    <td className="p-5 whitespace-nowrap">
                       {p.stock <= 0 ? (
                         <span className="flex items-center gap-2 text-red-500 text-[9px] font-black uppercase"><AlertTriangle size={12}/> AGOTADO</span>
                       ) : (
                         <span className="flex items-center gap-2 text-dark-green text-[9px] font-black uppercase"><CheckCircle size={12}/> COMPLETO</span>
                       )}
                    </td>
                    <td className="p-5 font-mono text-neutral-400">
                       ${(p.cost || 0).toLocaleString()}
                    </td>
                    <td className="p-5 font-mono text-neutral-400">
                       ${(p.freight || 15000).toLocaleString()}
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col">
                        <span className="font-mono text-dark-accent font-black text-sm">
                          ${(p.price - (p.cost || 0) - (p.freight || 15000)).toLocaleString()}
                        </span>
                        <span className="text-[8px] text-neutral-600 uppercase font-bold tracking-tighter">Utilidad neta</span>
                      </div>
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <Database className="mx-auto text-neutral-800 w-12 h-12" />
              <p className="text-neutral-600 text-[10px] uppercase font-bold">
                {products.length === 0 ? "No hay catálogo en la nube." : "No se encontraron productos."}
              </p>
              {products.length === 0 && (
                <button 
                  onClick={onReset}
                  disabled={isResetting}
                  className="bg-dark-accent text-black px-6 py-2 rounded-xl text-[10px] font-bold uppercase transition-all hover:scale-105 disabled:opacity-50"
                >
                  {isResetting ? "Sincronizando..." : "SINCRONIZAR CATÁLOGO"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MonitorTab({ activities }: { activities: Activity[], key?: string }) {
  const [monitorView, setMonitorView] = useState<'chat' | 'campaigns'>('chat');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  useEffect(() => {
    if (monitorView === 'campaigns') {
      setLoadingCampaigns(true);
      const q = query(collection(db, 'trendCampaigns'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(q, async (snap) => {
        const camps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const enriched = await Promise.all(camps.map(async (c: any) => {
          try {
            const qQueue = query(collection(db, 'trendQueue'), where('campaignId', '==', c.id));
            const qSnap = await getDocs(qQueue);
            let sentCount = 0;
            let pendingCount = 0;
            let failedCount = 0;
            qSnap.forEach((d: any) => {
              const status = d.data().status;
              if (status === 'sent') sentCount++;
              else if (status === 'pending') pendingCount++;
              else if (status === 'failed') failedCount++;
            });
            return { ...c, sentCount, pendingCount, failedCount };
          } catch (e) {
            console.error(e);
            return c;
          }
        }));
        setCampaigns(enriched);
        setLoadingCampaigns(false);
      });
      return () => unsub();
    }
  }, [monitorView]);

  const formatTime = (ts: any) => {
    return safeFormat(ts, "HH:mm:ss");
  };

  const getDuration = (start: any, end: any) => {
    if (!start || !end) return null;
    try {
      const s = start.toDate ? start.toDate().getTime() : new Date(start).getTime();
      const e = end.toDate ? end.toDate().getTime() : new Date(end).getTime();
      if (isNaN(s) || isNaN(e)) return "--:--";
      return ((e - s) / 1000).toFixed(1) + "s";
    } catch (e) {
      return "--:--";
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex bg-neutral-900 rounded-xl p-1 border border-neutral-800 self-start inline-flex">
        <button
          onClick={() => setMonitorView('chat')}
          className={cn(
            "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2",
            monitorView === 'chat' ? "bg-dark-accent text-black shadow-[0_4px_15px_rgba(242,125,38,0.2)]" : "text-neutral-500 hover:text-white"
          )}
        >
          <MessageSquare size={14} />
          Chat en Vivo
        </button>
        <button
          onClick={() => setMonitorView('campaigns')}
          className={cn(
            "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2",
            monitorView === 'campaigns' ? "bg-dark-accent text-black shadow-[0_4px_15px_rgba(242,125,38,0.2)]" : "text-neutral-500 hover:text-white"
          )}
        >
          <TrendingUp size={14} />
          Campañas Masivas
        </button>
      </div>

      {monitorView === 'chat' && (
        <>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm">
            <div className="p-6 border-b border-neutral-800 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-dark-accent/10 flex items-center justify-center border border-dark-accent/20">
                  <Clock className="w-4 h-4 text-dark-accent" />
                </div>
                <div>
                  <h3 className="text-white text-xs font-black uppercase tracking-widest">Monitor de Respuesta Jan</h3>
                  <p className="text-[10px] text-neutral-500">Auditoría de tiempos de procesamiento y errores.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-dark-green animate-pulse" />
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Escaneando Hook...</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/40 border-b border-neutral-800">
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest">Cliente / Mensaje</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Recibido</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Proceso</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Respuesta</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Duración</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest">Estado / Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {activities.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-white uppercase tracking-tight mb-1">{(item.from || "unknown").replace("whatsapp:", "")}</span>
                          <p className="text-[11px] text-neutral-400 italic line-clamp-1 max-w-xs group-hover:text-neutral-200 transition-colors">
                            "{(item.message || "").substring(0, 500)}..."
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center font-mono text-[10px] text-neutral-500">{formatTime(item.receivedAt || item.timestamp)}</td>
                      <td className="px-6 py-5 text-center font-mono text-[10px] text-neutral-500">{formatTime(item.processingAt)}</td>
                      <td className="px-6 py-5 text-center font-mono text-[10px] text-neutral-500">{formatTime(item.respondedAt)}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-[10px] font-black text-dark-accent bg-dark-accent/5 px-2 py-0.5 rounded border border-dark-accent/10">
                          {getDuration(item.receivedAt || item.timestamp, item.respondedAt || item.errorAt) || "..."}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            item.status === 'respondido' ? 'bg-dark-green' :
                            item.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                            'bg-dark-accent animate-pulse'
                          )} />
                          <div className="flex flex-col min-w-0">
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest",
                              item.status === 'error' ? 'text-red-400' : 'text-neutral-300'
                            )}>
                              {item.status}
                            </span>
                            {item.status === 'error' && (
                              <span className="text-[9px] text-red-900/80 truncate max-w-[150px] font-mono leading-none mt-1">
                                {item.response || "Error técnico"}
                              </span>
                            )}
                            {item.status === 'respondido' && (
                              <span className="text-[9px] text-neutral-600 truncate max-w-[150px] italic leading-none mt-1">
                                {item.response}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-20">
                          <Database size={32} />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em]">Esperando activad de WhatsApp...</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-dark-accent/5 border border-dark-accent/10 p-6 rounded-2xl flex items-start gap-4 ring-1 ring-white/5">
            <AlertTriangle className="text-dark-accent w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-white text-xs font-bold uppercase tracking-widest">Guía de Auditoría</h4>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Si ves un estado en <span className="text-red-400 font-bold">ROJO</span>, el log te dirá si falló la API de NVIDIA/OpenRouter o si Twilio rechazó el mensaje. 
                El tiempo ideal de respuesta debe ser menor a <span className="text-white font-mono">15.0s</span> para mantener la fluidez del chat.
              </p>
            </div>
          </div>
        </>
      )}

      {monitorView === 'campaigns' && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-neutral-800 bg-black/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-dark-accent/10 flex items-center justify-center border border-dark-accent/20">
                <TrendingUp className="w-4 h-4 text-dark-accent" />
              </div>
              <div>
                <h3 className="text-white text-xs font-black uppercase tracking-widest">Historial de Disparadores Masivos</h3>
                <p className="text-[10px] text-neutral-500">Auditoría de campañas de tendencias enviadas.</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-neutral-800">
                  <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest">Fecha / Hora</th>
                  <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest">Campaña / Producto</th>
                  <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Candidatos</th>
                  <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Enviados</th>
                  <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Pendientes</th>
                  <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Fallidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {campaigns.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5 text-left font-mono text-[10px] text-neutral-400">
                      {item.createdAt ? safeFormat(item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt, "dd/MM/yyyy HH:mm") : "N/A"}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-white uppercase tracking-tight">{item.productName}</span>
                        <span className="text-[9px] text-neutral-500 font-mono mt-0.5">ID: {item.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-[11px] font-bold text-white">{item.totalCandidates || 0}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-[11px] font-bold text-dark-green bg-dark-green/10 px-2 py-0.5 rounded border border-dark-green/20">
                        {item.sentCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {item.pendingCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={cn(
                        "text-[11px] font-bold px-2 py-0.5 rounded border",
                        (item.failedCount || 0) > 0 ? "text-red-500 bg-red-500/10 border-red-500/20" : "text-neutral-500 bg-neutral-800 border-neutral-700"
                      )}>
                        {item.failedCount || 0}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loadingCampaigns && campaigns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <Database size={32} />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No hay campañas registradas</p>
                      </div>
                    </td>
                  </tr>
                )}
                {loadingCampaigns && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-50">
                        <RefreshCw className="animate-spin text-dark-accent" size={24} />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-dark-accent">Cargando...</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function RecoveryTab({ activities, onSelectUser }: { activities: Activity[], onSelectUser: (phone: string) => void, key?: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Find users whose last status was 'recibido' (abandoned)
        const userMap = new Map();
        activities.forEach(a => {
          if (a.from && !userMap.has(a.from)) {
            userMap.set(a.from, a);
          }
        });
        
        const abandonedLeads = Array.from(userMap.values())
          .filter(a => a.status === 'recibido')
          .slice(0, 10);
          
        setLeads(abandonedLeads);
      } catch (e) {
        console.error("Error fetching leads:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, [activities]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5 space-y-4">
          <div className="flex items-center gap-3 text-dark-accent mb-2">
            <Zap size={20} />
            <h3 className="text-xs font-black uppercase tracking-[0.2em]">Activación Proactiva</h3>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Estos clientes nos escribieron pero Jan no ha podido cerrar la venta aún. 
            Lanza un "empujoncito" automático para recuperar el interés.
          </p>
          <div className="bg-dark-accent/10 border border-dark-accent/20 p-4 rounded-xl">
             <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-dark-accent font-black uppercase">Ventas en Riesgo</span>
                <span className="text-xl font-serif italic text-white">{leads.length}</span>
             </div>
             <div className="w-full h-1 bg-neutral-900 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-dark-accent w-1/3 animate-pulse" />
             </div>
          </div>
        </div>

        <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5 flex flex-col justify-center text-center space-y-4">
           <Truck className="mx-auto text-neutral-800 w-10 h-10" />
           <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-widest">Efectividad de Jan</h4>
              <p className="text-2xl font-serif italic text-dark-accent">82%</p>
              <p className="text-[9px] text-neutral-600 uppercase font-black">Conversión de Recuperación</p>
           </div>
        </div>
      </div>

      <div className="bg-[#111] border border-neutral-800 rounded-2xl overflow-hidden ring-1 ring-white/5">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
           <h3 className="text-white text-[10px] font-black uppercase tracking-widest">Prospectos Abandonados</h3>
           <span className="text-[9px] text-neutral-600 font-mono">Monitor en Vivo</span>
        </div>
        <div className="divide-y divide-neutral-800">
          {leads.map((l) => (
            <div key={l.id} className="p-6 flex items-center justify-between group hover:bg-white/5 transition-all">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:border-dark-accent transition-colors">
                     <User size={16} />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-white uppercase">{(l.from || "unknown").replace('whatsapp:', '')}</p>
                     <p className="text-[10px] text-neutral-500 line-clamp-1 italic">"{(l.message || "").substring(0, 300)}..."</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                     <p className="text-[9px] text-neutral-600 uppercase font-black">Hace</p>
                     <p className="text-[10px] text-white font-mono">15 min</p>
                  </div>
                  <button className="bg-neutral-800 hover:bg-dark-accent hover:text-black p-3 rounded-xl transition-all border border-neutral-700">
                     <RefreshCw size={14} className="group-hover:animate-spin" />
                  </button>
               </div>
            </div>
          ))}
          {leads.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <CheckCircle className="mx-auto text-dark-green w-12 h-12" />
              <p className="text-neutral-600 text-[10px] uppercase font-bold tracking-widest">¡Todos los clientes están atendidos!</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CRMTab({ customers, selectedUser, onSelectUser }: { customers: any[], selectedUser: string | null, onSelectUser: (phone: string) => void, key?: string }) {
  // Aggregate stats
  const total = customers.length;
  const inPipeline = customers.filter(c => c.etapa === 'negociando' || c.etapa === 'interesado').length;
  const highPriority = customers.filter(c => c.prioridad === 'alta').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111] border border-neutral-800 p-6 rounded-2xl ring-1 ring-white/5">
          <p className="text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-2">Total Prospectos</p>
           <p className="text-3xl font-mono text-white">{total}</p>
        </div>
        <div className="bg-[#111] border border-neutral-800 p-6 rounded-2xl ring-1 ring-white/5">
          <p className="text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-2">En Negociación</p>
           <p className="text-3xl font-mono text-white">{inPipeline}</p>
        </div>
        <div className="bg-dark-accent/10 border border-dark-accent/20 p-6 rounded-2xl ring-1 ring-dark-accent/30">
          <p className="text-[10px] uppercase font-black tracking-widest text-dark-accent/80 mb-2">Prioridad Alta (Score &gt; 70)</p>
           <p className="text-3xl font-mono text-dark-accent">{highPriority}</p>
        </div>
      </div>

      <div className="bg-[#111] border border-neutral-800 rounded-2xl overflow-hidden ring-1 ring-white/5">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
            <h3 className="text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><User size={14} /> Pipeline Activo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/30">
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500 w-6"></th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Cliente</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Etapa / Score</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Intención / Producto</th>
                 <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Objeciones</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500 text-right">Interacción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {customers.map(c => {
                const getEtapaColor = (etapa: string) => {
                  switch(etapa) {
                    case 'negociando': return 'from-dark-accent/20 text-dark-accent border-dark-accent/30';
                    case 'interesado': return 'from-blue-500/20 text-blue-400 border-blue-500/30';
                    default: return 'from-neutral-500/20 text-neutral-400 border-neutral-500/30';
                  }
                };
                
                const timeStr = c.ultima_interaccion?.toMillis ? new Date(c.ultima_interaccion.toMillis()).toLocaleString() : 'N/A';

                return (
                  <tr key={c.id} className="hover:bg-neutral-900/50 transition-colors group cursor-pointer" onClick={() => onSelectUser(c.id)}>
                    <td className="p-4 text-neutral-400">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex justify-center items-center">
                        <User size={14} />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-sm text-white">{c.name || c.id}</div>
                      <div className="text-[10px] text-neutral-500">{c.phone || c.id}</div>
                    </td>
                    <td className="p-4">
                      <span className={cn("px-2 py-1 bg-gradient-to-r text-[9px] uppercase tracking-widest font-black rounded-lg border", getEtapaColor(c.etapa))}>
                        {c.etapa || 'nuevo'}
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-neutral-800 rounded-full overflow-hidden">
                          <div className={cn("h-full", (c.score || 0) > 70 ? "bg-dark-accent" : "bg-neutral-500")} style={{ width: `${Math.min(c.score || 0, 100)}%` }}></div>
                        </div>
                        <span className="text-[10px] text-white font-mono">{Math.floor(c.score || 0)}</span>
                      </div>
                    </td>
                     <td className="p-4 max-w-[200px]">
                      <div className="font-bold text-xs text-neutral-300 truncate">{c.intencion || 'Sin detectar'}</div>
                      <div className="text-[10px] text-neutral-500 truncate">{c.producto_interes || 'Gral'}</div>
                    </td>
                     <td className="p-4 max-w-[150px]">
                        <p className="text-[10px] text-neutral-400 truncate">{c.objeciones || 'ninguna'}</p>
                     </td>
                    <td className="p-4 text-right">
                      <div className="text-[10px] font-mono text-neutral-500">{timeStr}</div>
                      <div className="text-[9px] text-neutral-600 mt-1 uppercase font-bold tracking-widest group-hover:text-dark-accent transition-colors">
                        Ver Chat →
                      </div>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                   <td colSpan={6} className="p-8 text-center text-neutral-500 text-xs font-bold uppercase tracking-widest">
                     No hay prospectos en el CRM todavía.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function ConfigTab({ user, userStore, userStores, setUserStore, setUserStores, webhookUrl, copied, onCopy, onReset, isResetting, onClearTransactions, isClearing }: any) {
  const [storeData, setStoreData] = useState({
    name: userStore?.name || "",
    slug: userStore?.slug || "",
    botName: userStore?.botName || "",
    botTone: userStore?.botTone || "",
    botGoal: userStore?.botGoal || "",
    themeColor: userStore?.themeColor || "#4F46E5",
    dataToCollect: userStore?.dataToCollect || "",
    baseConocimiento: userStore?.baseConocimiento || "",
    btnNotificationLabel: userStore?.btnNotificationLabel || "Notificar Prueba",
    btnQuick1Label: userStore?.btnQuick1Label || "Beneficio",
    btnQuick1Message: userStore?.btnQuick1Message || "¡Patrón! Si paga ya por transferencia se libera de los $25.000 de seguro que cobra la transportadora por el contra-entrega. ¡No pierda esa plata y sea cliente VIP con despacho hoy mismo!",
    btnQuick2Label: userStore?.btnQuick2Label || "Cierre",
    btnQuick2Message: userStore?.btnQuick2Message || "¡Rey! Se me acabaron de llevar el penúltimo. Solo me queda UNO con su nombre. ¿Se lo separo ya mismo o se lo paso al siguiente?",
    btnQuick3Label: userStore?.btnQuick3Label || "Prioridad",
    btnQuick3Message: userStore?.btnQuick3Message || "¡Buenas! El repartidor ya está cargando el camión VIP. Si transfiere ahorita, su pedido sale de primero. ¿Hacemos el negocio ya para que le llegue mañana?",
    msgNewOrderTemplate: userStore?.msgNewOrderTemplate || "🔥 *NUEVO PEDIDO RECIBIDO* 🔥\n\n👤 Cliente: {nombre}\n📞 Tel: {telefono}\n📍 Ciudad: {ciudad}\n🏠 Dir: {direccion}\n📦 Producto: {producto}\n💰 Total: {total}",
    notificationPhone: userStore?.notificationPhone || "",
    shopifyDomain: userStore?.shopifyDomain || "",
    shopifyAccessToken: userStore?.shopifyAccessToken || "",
    shopifyAutoSync: userStore?.shopifyAutoSync || false,
    dropiApiKey: userStore?.dropiApiKey || "",
    dropiAutoSync: userStore?.dropiAutoSync || false,
    dropiPreferredCarrier: userStore?.dropiPreferredCarrier || "Servientrega",
    dropiBackupCarrier: userStore?.dropiBackupCarrier || "Interrapidisimo",
    metaPixelId: userStore?.metaPixelId || "",
    tiktokPixelId: userStore?.tiktokPixelId || ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingFromShopify, setIsSyncingFromShopify] = useState(false);
  const [isSyncingToShopify, setIsSyncingToShopify] = useState(false);
  const [officialBotNumber, setOfficialBotNumber] = useState("");
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loadingDbStatus, setLoadingDbStatus] = useState(false);

  const fetchDbStatus = async () => {
    setLoadingDbStatus(true);
    try {
      const res = await fetch("/api/db/supabase-status");
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      console.error("Error fetching db status", e);
    } finally {
      setLoadingDbStatus(false);
    }
  };

  const handleShopifySync = async (direction: 'from_shopify' | 'to_shopify') => {
    if (!userStore?.id) return;
    if (direction === 'from_shopify') {
      setIsSyncingFromShopify(true);
    } else {
      setIsSyncingToShopify(true);
    }
    try {
      const res = await fetch("/api/integration/shopify/sync-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: userStore.id, direction })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (e: any) {
      toast.error("Error de red: " + e.message);
    } finally {
      if (direction === 'from_shopify') {
        setIsSyncingFromShopify(false);
      } else {
        setIsSyncingToShopify(false);
      }
    }
  };

  useEffect(() => {
    fetch("/api/public/config")
      .then(res => res.json())
      .then(data => {
        if (data.whatsappNumber) setOfficialBotNumber(data.whatsappNumber);
      })
      .catch(err => console.error("Error fetching bot config", err));
    fetchDbStatus();
  }, []);

  const publicUrl = `https://chatbotjanadsia.up.railway.app/landing`;
  const whatsappNumber = officialBotNumber || userStore?.phone?.replace(/\D/g, '') || "14155238886";
  const recognitionMessage = `Hola, vengo de la tienda *${storeData.name}* ref: #${storeData.slug}`;
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(recognitionMessage)}`;

  useEffect(() => {
    setStoreData({
      name: userStore?.name || "",
      slug: userStore?.slug || "",
      botName: userStore?.botName || "",
      botTone: userStore?.botTone || "",
      botGoal: userStore?.botGoal || "",
      themeColor: userStore?.themeColor || "#4F46E5",
      dataToCollect: userStore?.dataToCollect || "",
      baseConocimiento: userStore?.baseConocimiento || "",
      btnNotificationLabel: userStore?.btnNotificationLabel || "Notificar Prueba",
      btnQuick1Label: userStore?.btnQuick1Label || "Beneficio",
      btnQuick1Message: userStore?.btnQuick1Message || "¡Patrón! Si paga ya por transferencia se libera de los $25.000 de seguro que cobra la transportadora por el contra-entrega. ¡No pierda esa plata y sea cliente VIP con despacho hoy mismo!",
      btnQuick2Label: userStore?.btnQuick2Label || "Cierre",
      btnQuick2Message: userStore?.btnQuick2Message || "¡Rey! Se me acabaron de llevar el penúltimo. Solo me queda UNO con su nombre. ¿Se lo separo ya mismo o se lo paso al siguiente?",
      btnQuick3Label: userStore?.btnQuick3Label || "Prioridad",
      btnQuick3Message: userStore?.btnQuick3Message || "¡Buenas! El repartidor ya está cargando el camión VIP. Si transfiere ahorita, su pedido sale de primero. ¿Hacemos el negocio ya para que le llegue mañana?",
      msgNewOrderTemplate: userStore?.msgNewOrderTemplate || "🔥 *NUEVO PEDIDO RECIBIDO* 🔥\n\n👤 Cliente: {nombre}\n📞 Tel: {telefono}\n📍 Ciudad: {ciudad}\n🏠 Dir: {direccion}\n📦 Producto: {producto}\n💰 Total: {total}",
      notificationPhone: userStore?.notificationPhone || "",
      shopifyDomain: userStore?.shopifyDomain || "",
      shopifyAccessToken: userStore?.shopifyAccessToken || "",
      shopifyAutoSync: userStore?.shopifyAutoSync || false,
      dropiApiKey: userStore?.dropiApiKey || "",
      dropiAutoSync: userStore?.dropiAutoSync || false,
      dropiPreferredCarrier: userStore?.dropiPreferredCarrier || "Servientrega",
      dropiBackupCarrier: userStore?.dropiBackupCarrier || "Interrapidisimo",
      metaPixelId: userStore?.metaPixelId || "",
      tiktokPixelId: userStore?.tiktokPixelId || ""
    });
  }, [userStore]);

  const handleSaveStore = async () => {
    if (!userStore?.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "stores", userStore.id), storeData);
      setUserStore({ ...userStore, ...storeData });
      toast.success("Tienda actualizada correctamente.");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 max-w-4xl">
       <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex items-center gap-3 text-dark-accent mb-4 md:mb-0">
               <Settings size={20} />
               <h3 className="text-xs font-black uppercase tracking-[0.2em]">Configuración de Negocios (SaaS)</h3>
             </div>
             <div className="flex items-center gap-3">
               <select 
                 value={userStore?.id || ""} 
                 onChange={(e) => {
                   const s = userStores.find((x: any) => x.id === e.target.value);
                   if (s) setUserStore(s);
                 }}
                 className="bg-black border border-neutral-800 py-2 px-6 text-xs rounded-xl focus:border-dark-accent text-white"
               >
                 {userStores.map((s: any) => (
                   <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>
                 ))}
               </select>
               <button 
                 onClick={async () => {
                   const confirmInfo = prompt("Escribe el nombre de tu nuevo negocio para configurarlo:");
                   if (!confirmInfo) return;
                   
                   const storeId = "store_" + Math.random().toString(36).substring(2, 9);
                   const newStore = {
                     ownerId: user.uid,
                     name: confirmInfo,
                     slug: confirmInfo.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                     botName: "Asesor",
                     botTone: "amigable y profesional",
                     botGoal: "vender y guiar",
                     themeColor: "#4F46E5"
                   };
                   await setDoc(doc(db, "stores", storeId), newStore);
                   const finalStore = { id: storeId, ...newStore };
                   setUserStores([...userStores, finalStore]);
                   setUserStore(finalStore);
                 }}
                 className="bg-neutral-800 hover:bg-neutral-700 py-2 px-4 rounded-xl text-[10px] font-bold uppercase transition-colors whitespace-nowrap"
               >
                 + Crear Nuevo
               </button>
             </div>
          </div>
          
          <hr className="border-neutral-800" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Nombre del Negocio</label>
              <input value={storeData.name} onChange={e => setStoreData({...storeData, name: e.target.value})} className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">URL Pública (Slug)</label>
              <input value={storeData.slug} onChange={e => setStoreData({...storeData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white" />
              <p className="text-[9px] text-neutral-600">tudominio.com/tienda/{storeData.slug}</p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Nombre del Bot IA</label>
              <input value={storeData.botName} onChange={e => setStoreData({...storeData, botName: e.target.value})} placeholder="Ej: Jan, María, Asesor" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Color de Marca</label>
              <div className="flex gap-2">
                <input type="color" value={storeData.themeColor} onChange={e => setStoreData({...storeData, themeColor: e.target.value})} className="h-10 w-12 rounded-lg cursor-pointer bg-black border border-neutral-800" />
                <input value={storeData.themeColor} onChange={e => setStoreData({...storeData, themeColor: e.target.value})} className="flex-1 bg-black border border-neutral-800 rounded-xl p-2 text-xs text-white uppercase" />
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Tono del Bot</label>
              <input value={storeData.botTone} onChange={e => setStoreData({...storeData, botTone: e.target.value})} placeholder="Ej: Amigable, Profesional, Paisa" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Objetivo Principal del Bot</label>
              <textarea value={storeData.botGoal} onChange={e => setStoreData({...storeData, botGoal: e.target.value})} placeholder="Ej: Vender productos del catálogo..." className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white min-h-[60px]" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Datos a Recolectar (Opcional, separados por asterisco *)</label>
              <textarea value={storeData.dataToCollect} onChange={e => setStoreData({...storeData, dataToCollect: e.target.value})} placeholder="Ej: * Nombre completo&#10;* Correo electrónico&#10;* Perfil de Facebook" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white min-h-[80px]" />
              <p className="text-[9px] text-neutral-500">Si se deja vacío, Jan pedirá los datos por defecto para vender (Nombre, Teléfono, Ciudad, Dirección, Referencia).</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Base de Conocimientos / Soporte Adicional</label>
              <textarea value={storeData.baseConocimiento} onChange={e => setStoreData({...storeData, baseConocimiento: e.target.value})} placeholder="Ej: Políticas de envío, garantías, preguntas frecuentes. Si el cliente pregunta algo de acá, el bot lo responderá. (Si pegabas mucha info por WhatsApp, pégala aquí)" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white min-h-[120px]" />
            </div>

            <div className="md:col-span-2 py-4">
              <div className="flex items-center gap-2 text-dark-accent mb-4">
                <Layout size={16} />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Interfaz y Mensajes Personalizados</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">WhatsApp Notificaciones</label>
                  <input value={storeData.notificationPhone} onChange={e => setStoreData({...storeData, notificationPhone: e.target.value})} placeholder="Ej: +57310..." className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white" />
                  <p className="text-[8px] text-neutral-500 italic">Número donde recibirás avisos de nuevos pedidos.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Botón de Notificación</label>
                  <input value={storeData.btnNotificationLabel} onChange={e => setStoreData({...storeData, btnNotificationLabel: e.target.value})} className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Plantilla Nuevo Pedido</label>
                  <textarea value={storeData.msgNewOrderTemplate} onChange={e => setStoreData({...storeData, msgNewOrderTemplate: e.target.value})} className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-[10px] font-mono text-white min-h-[100px]" />
                  <p className="text-[8px] text-neutral-500 italic">Usa {'{nombre}'}, {'{telefono}'}, {'{ciudad}'}, {'{direccion}'}, {'{producto}'}, {'{total}'}.</p>
                </div>

                <div className="space-y-4 md:col-span-2 border-t border-neutral-800 pt-4">
                  <label className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Atajos de Chat (Botones Rápidos)</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                       <input value={storeData.btnQuick1Label} onChange={e => setStoreData({...storeData, btnQuick1Label: e.target.value})} placeholder="Etiqueta 1" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-[10px] text-white font-bold" />
                       <textarea value={storeData.btnQuick1Message} onChange={e => setStoreData({...storeData, btnQuick1Message: e.target.value})} placeholder="Mensaje 1" className="w-full bg-black border border-neutral-800 rounded-lg p-2 text-[10px] text-white min-h-[60px]" />
                    </div>
                    <div className="space-y-2">
                       <input value={storeData.btnQuick2Label} onChange={e => setStoreData({...storeData, btnQuick2Label: e.target.value})} placeholder="Etiqueta 2" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-[10px] text-white font-bold" />
                       <textarea value={storeData.btnQuick2Message} onChange={e => setStoreData({...storeData, btnQuick2Message: e.target.value})} placeholder="Mensaje 2" className="w-full bg-black border border-neutral-800 rounded-lg p-2 text-[10px] text-white min-h-[60px]" />
                    </div>
                    <div className="space-y-2">
                       <input value={storeData.btnQuick3Label} onChange={e => setStoreData({...storeData, btnQuick3Label: e.target.value})} placeholder="Etiqueta 3" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-[10px] text-white font-bold" />
                       <textarea value={storeData.btnQuick3Message} onChange={e => setStoreData({...storeData, btnQuick3Message: e.target.value})} placeholder="Mensaje 3" className="w-full bg-black border border-neutral-800 rounded-lg p-2 text-[10px] text-white min-h-[60px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN DE INTEGRACIONES DE TERCEROS (SHOPIFY & DROPI) */}
          <div className="border-t border-neutral-800 pt-8 mt-6 space-y-6">
            <div className="flex items-center gap-2 text-dark-accent">
               <Share2 size={16} />
               <h4 className="text-[10px] font-black uppercase tracking-widest">Sincronización & Integraciones (Shopify & Dropi)</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* SHOPIFY INTEGRATION CARD */}
               <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                     <ShoppingBag size={14} className="text-green-400" />
                     <h5 className="text-[10px] uppercase font-black tracking-widest text-white">Tienda Shopify (Catálogo & Pedidos)</h5>
                  </div>
                  <p className="text-[9px] text-neutral-400">Automatiza la creación de pedidos de pago contra entrega en Shopify y sincroniza tu catálogo bidireccionalmente.</p>
                  
                  <div className="space-y-3">
                     <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase font-black">Dominio de Shopify</label>
                        <input 
                           value={storeData.shopifyDomain} 
                           onChange={e => setStoreData({...storeData, shopifyDomain: e.target.value})} 
                           placeholder="tu-tienda.myshopify.com" 
                           className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white" 
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase font-black">Admin Access Token (shpat_...)</label>
                        <input 
                           type="password"
                           value={storeData.shopifyAccessToken} 
                           onChange={e => setStoreData({...storeData, shopifyAccessToken: e.target.value})} 
                           placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                           className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono" 
                        />
                     </div>
                     <div className="flex items-center gap-2 pt-2">
                        <input 
                           type="checkbox" 
                           id="shopifyAutoSync" 
                           checked={storeData.shopifyAutoSync} 
                           onChange={e => setStoreData({...storeData, shopifyAutoSync: e.target.checked})} 
                           className="rounded border-neutral-800 bg-black text-dark-accent focus:ring-0" 
                        />
                        <label htmlFor="shopifyAutoSync" className="text-[10px] text-neutral-300 font-bold select-none cursor-pointer">
                           Enviar pedidos automáticamente a Shopify (Contra Entrega)
                        </label>
                     </div>

                     <div className="grid grid-cols-2 gap-3 pt-3">
                        <button 
                           onClick={() => handleShopifySync('from_shopify')} 
                           disabled={isSyncingFromShopify || !storeData.shopifyDomain || !storeData.shopifyAccessToken}
                           className="bg-neutral-800 hover:bg-neutral-700 text-white p-2.5 rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-30"
                        >
                           {isSyncingFromShopify ? "Sincronizando..." : "Importar desde Shopify"}
                        </button>
                        <button 
                           onClick={() => handleShopifySync('to_shopify')} 
                           disabled={isSyncingToShopify || !storeData.shopifyDomain || !storeData.shopifyAccessToken}
                           className="bg-neutral-800 hover:bg-neutral-700 text-white p-2.5 rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-30"
                        >
                           {isSyncingToShopify ? "Exportar a Shopify" : "Exportar a Shopify"}
                        </button>
                     </div>
                  </div>
               </div>

               {/* DROPI INTEGRATION CARD */}
               <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                     <Truck size={14} className="text-blue-400" />
                     <h5 className="text-[10px] uppercase font-black tracking-widest text-white">Dropshipping Dropi (Proveedores & Guías)</h5>
                  </div>
                  <p className="text-[9px] text-neutral-400">Envía los pedidos directamente a la transportadora seleccionada en Dropi y genera la guía de despacho de inmediato.</p>

                  <div className="space-y-3">
                     <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase font-black">API Token de Dropi</label>
                        <input 
                           type="password"
                           value={storeData.dropiApiKey} 
                           onChange={e => setStoreData({...storeData, dropiApiKey: e.target.value})} 
                           placeholder="API Key de tu cuenta Dropi (o escribe 'TEST')" 
                           className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono" 
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase font-black">Transportadora Preferida</label>
                        <select 
                           value={storeData.dropiPreferredCarrier} 
                           onChange={e => setStoreData({...storeData, dropiPreferredCarrier: e.target.value})} 
                           className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none focus:border-dark-accent"
                        >
                           <option value="Servientrega">Servientrega</option>
                           <option value="Interrapidisimo">Interrapidísimo</option>
                           <option value="Envía">Envía Colvanes</option>
                           <option value="Coordinadora">Coordinadora</option>
                           <option value="Domina">Domina Entrega</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] text-neutral-500 uppercase font-black">Transportadora de Respaldo</label>
                        <select 
                           value={storeData.dropiBackupCarrier || "Interrapidisimo"} 
                           onChange={e => setStoreData({...storeData, dropiBackupCarrier: e.target.value})} 
                           className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none focus:border-dark-accent"
                        >
                           <option value="Servientrega">Servientrega</option>
                           <option value="Interrapidisimo">Interrapidísimo</option>
                           <option value="Envía">Envía Colvanes</option>
                           <option value="Coordinadora">Coordinadora</option>
                           <option value="Domina">Domina Entrega</option>
                        </select>
                     </div>
                     <div className="flex items-center gap-2 pt-2">
                        <input 
                           type="checkbox" 
                           id="dropiAutoSync" 
                           checked={storeData.dropiAutoSync} 
                           onChange={e => setStoreData({...storeData, dropiAutoSync: e.target.checked})} 
                           className="rounded border-neutral-800 bg-black text-dark-accent focus:ring-0" 
                        />
                        <label htmlFor="dropiAutoSync" className="text-[10px] text-neutral-300 font-bold select-none cursor-pointer">
                           Enviar pedidos automáticamente a Dropi
                        </label>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {/* MARKETING PIXELS CARD (META & TIKTOK) */}
          <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl space-y-4">
             <div className="flex items-center gap-2">
                <span className="text-amber-400">📊</span>
                <h5 className="text-[10px] uppercase font-black tracking-widest text-white">Píxeles de Rastreo & Conversiones (Meta / Facebook & TikTok)</h5>
             </div>
             <p className="text-[9px] text-neutral-400">Registra automáticamente visitas a tu catálogo, clicks en botones de WhatsApp, inicios de pago y compras completadas para optimizar tus campañas publicitarias.</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[9px] text-neutral-500 uppercase font-black">Meta / Facebook Pixel ID</label>
                   <input 
                      value={storeData.metaPixelId || ""} 
                      onChange={e => setStoreData({...storeData, metaPixelId: e.target.value})} 
                      placeholder="Ej: 8371948291039" 
                      className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono animate-none" 
                   />
                   <p className="text-[8px] text-neutral-500">Inyecta el script oficial de Meta Pixel en tu página de manera dinámica y envía eventos de PageView, ViewContent, AddToCart, InitiateCheckout, Purchase y Contact.</p>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] text-neutral-500 uppercase font-black">TikTok Pixel ID</label>
                   <input 
                      value={storeData.tiktokPixelId || ""} 
                      onChange={e => setStoreData({...storeData, tiktokPixelId: e.target.value})} 
                      placeholder="Ej: C982189012HK9012" 
                      className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono animate-none" 
                   />
                   <p className="text-[8px] text-neutral-500">Inyecta el script oficial de TikTok Pixel y realiza el seguimiento completo del embudo de conversión publicitario.</p>
                </div>
             </div>
          </div>

          {/* SUPABASE CONNECTION DIAGNOSTICS CARD */}
          <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-dark-accent">
                   <span className="text-emerald-400">⚡</span>
                   <h5 className="text-[10px] uppercase font-black tracking-widest text-white">Estado de Base de Datos (Supabase)</h5>
                </div>
                <button 
                  onClick={fetchDbStatus} 
                  disabled={loadingDbStatus}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                   <RefreshCw size={10} className={loadingDbStatus ? "animate-spin" : ""} />
                   {loadingDbStatus ? "Actualizar" : "Actualizar"}
                </button>
             </div>
             <p className="text-[9px] text-neutral-400 leading-normal">
                Tu base de datos en Supabase resguarda de manera permanente toda la información de tu chatbot: tus productos, tus pedidos, tus conversaciones y el historial del CRM.
             </p>
             
             {dbStatus ? (
                <div className="space-y-4">
                   <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-3.5 rounded-xl">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide">Modo de Operación</span>
                      <div className="flex items-center gap-2">
                         <span className={`w-2 h-2 rounded-full ${dbStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                         <span className={`text-[10px] font-black uppercase tracking-widest ${dbStatus.connected ? "text-emerald-400" : "text-amber-400"}`}>
                            {dbStatus.mode}
                         </span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(dbStatus.collections || {}).map(([name, colInfo]: [string, any]) => (
                         <div key={name} className="bg-black/50 border border-neutral-800 p-3 rounded-xl flex flex-col justify-between hover:border-neutral-700 transition-colors">
                            <span className="text-[9px] text-neutral-500 font-mono tracking-wider truncate uppercase">{name}</span>
                            <div className="flex items-baseline gap-1 mt-1.5">
                               <span className="text-lg font-black text-white leading-none">{colInfo.localCount}</span>
                               <span className="text-[8px] text-neutral-600 font-bold uppercase tracking-wider">filas</span>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             ) : (
                <div className="text-center py-6 border border-dashed border-neutral-800 rounded-xl">
                   <p className="text-[10px] text-neutral-500">Cargando estado de la base de datos...</p>
                </div>
             )}
          </div>

          <button onClick={handleSaveStore} disabled={isSaving} className="w-full bg-dark-accent text-black font-black uppercase text-[10px] tracking-widest py-3 rounded-xl disabled:opacity-50">
            {isSaving ? "GUARDANDO..." : "GUARDAR CONFIGURACIÓN"}
          </button>

          <div className="bg-black/40 border border-neutral-800 p-6 rounded-2xl space-y-4">
             <div className="flex items-center gap-2 text-dark-accent mb-2">
                <ExternalLink size={16} />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Lanzamiento del Negocio</h4>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Enlace del Catálogo Público</label>
                   <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-3 rounded-xl">
                      <span className="flex-1 text-[10px] text-neutral-300 font-mono truncate">{publicUrl}</span>
                      <button 
                         onClick={() => {
                           navigator.clipboard.writeText(publicUrl);
                           toast.success("URL de catálogo copiada");
                         }}
                         className="p-1.5 hover:bg-neutral-800 rounded-lg text-dark-accent transition-colors"
                      >
                         <Copy size={14} />
                      </button>
                   </div>
                   <p className="text-[8px] text-neutral-600 italic">Comparte este link en tu bio de Instagram o TikTok.</p>
                </div>

                <div className="space-y-2">
                   <label className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Enlace de Reconocimiento (WhatsApp)</label>
                   <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-3 rounded-xl">
                      <span className="flex-1 text-[10px] text-neutral-300 font-mono truncate">{whatsappLink}</span>
                      <button 
                         onClick={() => {
                           navigator.clipboard.writeText(whatsappLink);
                           toast.success("Enlace de WhatsApp copiado");
                         }}
                         className="p-1.5 hover:bg-neutral-800 rounded-lg text-dark-accent transition-colors"
                      >
                         <Copy size={14} />
                      </button>
                   </div>
                   <p className="text-[8px] text-neutral-600 italic">Pega este link en tu publicidad para que Jan sepa de qué tienda vienen.</p>
                </div>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl space-y-6 ring-1 ring-white/5 h-fit">
             <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-3 text-dark-accent">
                 <Zap size={20} />
                 <h3 className="text-xs font-black uppercase tracking-[0.2em]">Configuración Webhook</h3>
               </div>
               <button
                     onClick={onCopy}
                     className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-all text-dark-muted flex items-center gap-2 text-[10px]"
                   >
                     {copied ? <CheckCircle className="w-4 h-4 text-dark-green" /> : <Copy className="w-4 h-4" />}
                     {copied ? 'COPIADO' : 'COPIAR URL'}
               </button>
             </div>
             <p className="text-[11px] text-neutral-500 leading-relaxed">
                Jan v3.1 está listo. Pega esta URL en tu consola de Twilio Sandbox bajo <span className="text-dark-accent font-medium uppercase font-mono tracking-tighter">"WHEN A MESSAGE COMES IN"</span>.
             </p>
             <div className="bg-orange-900/10 border border-orange-900/30 p-4 rounded-xl space-y-2">
                <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={12} /> Aviso de Restricción
                </p>
                <p className="text-[10px] text-neutral-500 leading-tight">
                  Las cuentas <strong>Twilio Trial</strong> están limitadas a <strong>50 mensajes diarios</strong>. Hemos optimizado a Jan para que use un solo mensaje por respuesta (texto+imagen), duplicando su capacidad, pero recuerda que este es un límite de tu cuenta de Twilio.
                </p>
             </div>
             <div className="relative">
                <div className="flex items-center p-5 bg-black/40 border border-neutral-800 rounded-xl font-mono text-[11px] ring-1 ring-white/5">
                   <span className="text-dark-accent select-all break-all">{webhookUrl}</span>
                </div>
             </div>
          </div>

          <div className="space-y-8">
             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl space-y-4 ring-1 ring-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                   <div className="bg-dark-green/20 text-dark-green text-[8px] font-black px-2 py-0.5 rounded border border-dark-green/30 uppercase tracking-widest animate-pulse">
                      Automático
                   </div>
                </div>
                <div className="flex items-center gap-3 text-dark-accent mb-2">
                   <Truck size={20} />
                   <h3 className="text-xs font-black uppercase tracking-[0.2em]">Logística Dropi</h3>
                </div>
                <p className="text-[11px] text-neutral-500">Jan subirá los pedidos aprobados directamente a tu panel de Dropi para que salgan a despacho sin manos humanas.</p>
                <div className="p-4 bg-black/40 border border-neutral-800 rounded-xl flex items-center justify-between">
                   <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">API Key Status</span>
                   <span className="text-[10px] text-white font-mono">DROPI_***_12345</span>
                </div>
             </div>

             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl space-y-4 ring-1 ring-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4">
                  <div className="bg-dark-accent/20 text-dark-accent text-[8px] font-black px-2 py-0.5 rounded border border-dark-accent/30 uppercase tracking-widest">
                     Premium
                  </div>
               </div>
               <div className="flex items-center gap-3 text-dark-accent mb-2">
                  <FileText size={20} />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em]">Emails Profesionales</h3>
               </div>
               <p className="text-[11px] text-neutral-500">Cada venta genera una factura profesional o guía de despacho enviada al email del cliente vía SendGrid.</p>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-dark-green" />
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Servicio de Notificación Activo</span>
               </div>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
         <div className="bg-red-900/10 border border-red-900/20 p-8 rounded-2xl space-y-4">
            <div>
              <h4 className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1">Zona de Peligro: Reiniciar para Ventas Reales</h4>
              <p className="text-red-900/60 text-[10px]">Borra TODOS los pedidos y actividades de prueba acumulados hasta hoy.</p>
            </div>
            <button 
              onClick={onClearTransactions}
              disabled={isClearing}
              className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isClearing ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
              {isClearing ? "BORRANDO DATOS..." : "REINICIAR TABLERO (MODO REAL)"}
            </button>
         </div>

         <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl space-y-4">
            <div>
              <h4 className="text-neutral-400 text-[10px] font-black uppercase tracking-widest mb-1">Sincronización Total</h4>
              <p className="text-neutral-600 text-[10px]">Actualiza el catálogo de productos desde el servidor.</p>
            </div>
            <button 
              onClick={onReset}
              disabled={isResetting}
              className="w-full border border-neutral-800 hover:border-dark-accent text-neutral-400 hover:text-white px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isResetting ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              {isResetting ? "Reseteando..." : "Sincronizar Catálogo Ahora"}
            </button>
         </div>
       </div>
    </motion.div>
  );
}

import Storefront from "./components/Storefront";
import LandingPage from "./components/LandingPage";

// Global App component with Routing
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tienda/:slug" element={<Storefront />} />
        <Route path="/catalog" element={<Navigate to="/landing" replace />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/" element={<JanAdmin />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
