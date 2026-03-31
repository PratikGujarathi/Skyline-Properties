import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc, where, updateDoc, serverTimestamp, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Home, MapPin, DollarSign, Loader2, List, Image as ImageIcon, Globe, Building2, Bed, Bath, Maximize, Maximize2, Link as LinkIcon, Edit3, X, Calendar, MessageSquare, Check, XCircle, Star, TrendingUp, BarChart3, PieChart as PieChartIcon, ShoppingCart, FileText, Download, Upload, MessageCircle, Clock, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn } from '../lib/utils';
import { VirtualTourViewer } from '../components/VirtualTourViewer';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';

interface Property {
  id: string;
  title: string;
  description: string;
  country: string;
  city: string;
  area: string;
  price: number;
  type: 'villa' | 'flat' | 'plot';
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  images: string[];
  virtualTourURL: string;
  status: 'available' | 'sold';
  agentId: string;
  createdAt: any;
  updatedAt: any;
  lat?: number;
  lng?: number;
}

interface Appointment {
  id: string;
  propertyId: string;
  userId: string;
  agentId: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  propertyTitle?: string;
  userEmail?: string;
  userName?: string;
}

interface Review {
  id: string;
  propertyId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  propertyTitle?: string;
}

interface Transaction {
  id: string;
  propertyId: string;
  buyerId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  agentId: string;
  price: number;
  commission: number;
  status: 'completed' | 'pending';
  createdAt: any;
  propertyTitle?: string;
  country?: string;
}

interface DocumentRecord {
  id: string;
  propertyId: string;
  userId: string;
  agreementURL?: string;
  paperworkURL?: string;
  createdAt: string;
  propertyTitle?: string;
  userEmail?: string;
  userName?: string;
}

export const Admin: React.FC = () => {
  const { user, profile, loading: authLoading, isAdmin, isAuthReady } = useAuth();
  
  const isSuperAdmin = user?.email?.toLowerCase() === 'pratikgujarathi1818@gmail.com' || 
    user?.email?.toLowerCase() === 'grofistogma08@gmail.com';
  
  if (!isAuthReady || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };

  const [properties, setProperties] = useState<Property[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'listings' | 'appointments' | 'reviews' | 'analytics' | 'documents' | 'transactions'>('listings');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTourModal, setShowTourModal] = useState(false);
  const [selectedTour, setSelectedTour] = useState<{ url: string; title: string } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    country: '',
    city: '',
    area: '',
    price: '',
    type: 'flat' as 'villa' | 'flat' | 'plot',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    virtualTourURL: '',
    status: 'available' as 'available' | 'sold',
    lat: '',
    lng: '',
  });
  
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<'idle' | 'saving' | 'completed'>('idle');
  
  // Document upload state
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [uploadingAgreementId, setUploadingAgreementId] = useState<string | null>(null);
  const [uploadingPaperworkId, setUploadingPaperworkId] = useState<string | null>(null);
  const [docFormData, setDocFormData] = useState({
    propertyId: '',
    userId: '',
    agreementURL: '',
    paperworkURL: '',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || !isAdmin) return;

    const path = 'properties';
    console.log('Setting up agent properties listener...', { 
      uid: user.uid, 
      email: user.email,
      isAdmin,
      profileRole: profile?.role 
    });
    
    // Debug: Fetch all properties once to see if they exist
    getDocs(collection(db, path)).then(snap => {
      console.log(`DEBUG: Total properties in collection: ${snap.docs.length}`);
      snap.docs.forEach(d => {
        console.log(`DEBUG: Property ID: ${d.id}, agentId: ${d.data().agentId}, title: ${d.data().title}`);
      });
    }).catch(err => {
      console.error('DEBUG: Error fetching all properties:', err);
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (e) {
        // Silent catch for debug call
      }
    });
    
    // For super-admins, we might want to see all properties, but for now we'll stick to the agent's own properties
    // unless they are explicitly marked as a super-admin in the UI.
    const isSuperAdmin = user?.email?.toLowerCase() === 'pratikgujarathi1818@gmail.com' || 
      user?.email?.toLowerCase() === 'grofistogma08@gmail.com';
    
    const q = isSuperAdmin 
      ? query(collection(db, path)) // Super-admins see all
      : query(collection(db, path), where('agentId', '==', user.uid)); // Agents see only theirs
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Received properties snapshot: ${snapshot.docs.length} documents. SuperAdmin: ${isSuperAdmin}`);
      const props = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Property[];
      
      // Sort manually on client side to avoid index requirement
      const sortedProps = [...props].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setProperties(sortedProps);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching agent properties:', error);
      toast.error('Failed to load properties. Please check your connection or permissions.');
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, isAdmin, isAuthReady, authLoading]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || !isAdmin) return;

    const path = 'appointments';
    const q = isSuperAdmin
      ? query(collection(db, path), orderBy('createdAt', 'desc'))
      : query(
          collection(db, path),
          where('agentId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => {
        const data = doc.data();
        const userProfile = allUsers.find(u => u.id === data.userId);
        return {
          id: doc.id,
          ...data,
          userEmail: userProfile?.email || data.userEmail || 'Client',
          userName: userProfile?.name || data.userName || 'Client'
        };
      }) as Appointment[];
      setAppointments(apps);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isAuthReady, authLoading, isSuperAdmin, allUsers]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || !isAdmin) return;

    const path = 'reviews';
    const q = query(
      collection(db, path),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      
      // Filter reviews for properties owned by this agent
      const agentPropertyIds = properties.map(p => p.id);
      const filteredRevs = revs.filter(r => agentPropertyIds.includes(r.propertyId));
      
      setReviews(filteredRevs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, properties, isAdmin, isAuthReady, authLoading, isSuperAdmin]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || !isAdmin) return;

    const path = 'transactions';
    const q = isSuperAdmin
      ? query(collection(db, path), orderBy('createdAt', 'desc'))
      : query(
          collection(db, path),
          where('agentId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => {
        const data = doc.data();
        const property = properties.find(p => p.id === data.propertyId);
        const userProfile = allUsers.find(u => u.id === (data.buyerId || data.userId));
        return {
          id: doc.id,
          ...data,
          propertyTitle: property?.title,
          userEmail: userProfile?.email || data.userEmail || 'Client',
          userName: userProfile?.name || data.userName || 'Client',
          country: property?.country
        };
      }) as Transaction[];
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, properties, allUsers, isAdmin, isAuthReady, authLoading, isSuperAdmin]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || !isAdmin) return;

    const path = 'documents';
    const q = isSuperAdmin
      ? query(collection(db, path), orderBy('createdAt', 'desc'))
      : query(
          collection(db, path),
          where('agentId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        const property = properties.find(p => p.id === data.propertyId);
        const appointment = appointments.find(a => a.userId === data.userId);
        const userProfile = allUsers.find(u => u.id === data.userId);
        return {
          id: doc.id,
          ...data,
          propertyTitle: property?.title,
          userEmail: userProfile?.email || appointment?.userEmail || data.userEmail || 'Client',
          userName: userProfile?.name || data.userName || 'Client'
        };
      }) as DocumentRecord[];
      
      // Filter documents for properties owned by this agent
      const agentPropertyIds = properties.map(p => p.id);
      const filteredDocs = docs.filter(d => agentPropertyIds.includes(d.propertyId));
      
      setDocuments(filteredDocs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, properties, appointments, allUsers, isAdmin, isAuthReady, authLoading, isSuperAdmin]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || !isAdmin) return;

    const path = 'users';
    const q = isSuperAdmin
      ? query(collection(db, path))
      : query(
          collection(db, path),
          where('role', '==', 'USER')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUsers(usersList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isAuthReady, authLoading, isSuperAdmin]);

  if (!isAuthReady || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
        <p className="text-neutral-500">Verifying your credentials...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-full mb-6">
          <Home className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Agent Access Required</h1>
        <p className="text-neutral-500 max-w-md mb-8">
          This dashboard is only accessible to registered agents. If you are an agent, please ensure you are logged in correctly.
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-8 py-3 bg-navy text-gold font-bold rounded-xl hover:bg-navy/90 transition-all shadow-lg"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUrlChange = (index: number, value: string) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  const addImageUrlField = () => {
    setImageUrls([...imageUrls, '']);
  };

  const removeImageUrlField = (index: number) => {
    if (imageUrls.length > 1) {
      const newUrls = imageUrls.filter((_, i) => i !== index);
      setImageUrls(newUrls);
    } else {
      setImageUrls(['']);
    }
  };

  const submitProperty = async (finalImages: string[]) => {
    setIsSubmitting(true);
    setSubmissionStep('saving');
    
    const path = 'properties';
    console.log('DEBUG: Starting property submission with URLs...');
    
    try {
      // STEP 2: Firestore Write
      console.log('DEBUG: Saving to Firestore...');
      
      const propertyData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        country: formData.country.trim(),
        city: formData.city.trim(),
        area: formData.area.trim(),
        price: parseFloat(formData.price) || 0,
        type: formData.type,
        bedrooms: parseInt(formData.bedrooms) || 0,
        bathrooms: parseInt(formData.bathrooms) || 0,
        sqft: parseInt(formData.sqft) || 0,
        images: finalImages,
        virtualTourURL: formData.virtualTourURL.trim(),
        status: formData.status,
        agentId: user?.uid,
        updatedAt: serverTimestamp(),
        lat: parseFloat(formData.lat) || 0,
        lng: parseFloat(formData.lng) || 0,
      };

      if (editingId) {
        await updateDoc(doc(db, path, editingId), propertyData);
        toast.success('Property updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, path), {
          ...propertyData,
          createdAt: serverTimestamp(),
        });
        
        // Create alerts for all users
        const alertPath = 'alerts';
        const alertPromises = allUsers.map(u => 
          addDoc(collection(db, alertPath), {
            userId: u.id,
            title: 'New Property Alert!',
            message: `A new ${propertyData.type} in ${propertyData.city} has been listed for $${propertyData.price.toLocaleString()}.`,
            type: 'new_listing',
            propertyId: docRef.id,
            propertyData: {
              title: propertyData.title,
              price: propertyData.price,
              city: propertyData.city,
              image: propertyData.images[0] || null
            },
            read: false,
            createdAt: serverTimestamp()
          })
        );
        await Promise.all(alertPromises);
        
        toast.success('Property listed successfully!');
      }
      
      console.log('DEBUG: Firestore write success');
      setSubmissionStep('completed');
      setTimeout(() => {
        resetForm();
        setSubmissionStep('idle');
      }, 1500);

    } catch (error: any) {
      console.error('DEBUG: Global failure in submitProperty', error);
      toast.error('Failed to save property: ' + (error.message || 'Unknown error'));
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, path);
      setSubmissionStep('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) {
      toast.error('Unauthorized access');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    // Filter out empty URLs and validate
    const finalImages = imageUrls.filter(url => url.trim() !== '');
    
    // Basic URL validation
    const urlPattern = /^(https?:\/\/)/;
    const invalidUrls = finalImages.filter(url => !urlPattern.test(url));
    if (invalidUrls.length > 0) {
      toast.error('Some image URLs are invalid. They must start with http:// or https://');
      return;
    }

    if (finalImages.length === 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'No Images Provided',
        message: 'You have not provided any image URLs. Do you want to list this property without images?',
        confirmText: 'List Without Images',
        variant: 'warning',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          submitProperty(finalImages);
        }
      });
      return;
    }

    submitProperty(finalImages);
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      country: '',
      city: '',
      area: '',
      price: '',
      type: 'flat',
      bedrooms: '',
      bathrooms: '',
      sqft: '',
      virtualTourURL: '',
      status: 'available',
      lat: '',
      lng: '',
    });
    setImageUrls(['']);
  };

  const handleEdit = (property: Property) => {
    setEditingId(property.id);
    setFormData({
      title: property.title,
      description: property.description,
      country: property.country,
      city: property.city,
      area: property.area || '',
      price: property.price.toString(),
      type: property.type,
      bedrooms: property.bedrooms.toString(),
      bathrooms: property.bathrooms.toString(),
      sqft: property.sqft.toString(),
      virtualTourURL: property.virtualTourURL || '',
      status: property.status,
      lat: property.lat?.toString() || '',
      lng: property.lng?.toString() || '',
    });
    setImageUrls(property.images && property.images.length > 0 ? property.images : ['']);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    console.log('handleDelete called with id:', id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Listing',
      message: 'Are you sure you want to delete this listing? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        const path = `properties/${id}`;
        try {
          await deleteDoc(doc(db, 'properties', id));
          toast.success('Listing deleted');
        } catch (error: any) {
          console.error('Error deleting property:', error);
          if (error.code === 'permission-denied') {
            toast.error('Permission denied. You can only delete your own listings.');
          } else {
            toast.error('Failed to delete listing: ' + (error.message || 'Unknown error'));
          }
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: 'approved' | 'rejected') => {
    const path = `appointments/${appointmentId}`;
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Appointment ${newStatus}`);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  
  const handleMarkAsSold = async (property: Property) => {
    if (!user) return;
    
    // Find users who had appointments for this property to suggest as buyers
    const prospectiveBuyers = appointments
      .filter(app => app.propertyId === property.id)
      .map(app => app.userId);
    
    const uniqueProspectiveBuyers = Array.from(new Set(prospectiveBuyers));

    setConfirmDialog({
      isOpen: true,
      title: 'Mark as Sold',
      message: `Mark "${property.title}" as SOLD? Please select the buyer below.`,
      confirmText: 'Mark as Sold',
      variant: 'warning',
      onConfirm: async () => {
        const propertyPath = `properties/${property.id}`;
        const transactionPath = 'transactions';
        
        try {
          // 1. Update property status
          await updateDoc(doc(db, 'properties', property.id), {
            status: 'sold',
            updatedAt: serverTimestamp()
          });

          // 2. Create transaction
          const commissionRate = 0.05; // 5% commission
          const buyerProfile = allUsers.find(u => u.id === selectedBuyerId);
          
          await addDoc(collection(db, transactionPath), {
            propertyId: property.id,
            agentId: user.uid,
            userId: selectedBuyerId || null,
            userEmail: buyerProfile?.email || null,
            userName: buyerProfile?.name || 'Client',
            price: property.price,
            commission: property.price * commissionRate,
            status: 'completed',
            createdAt: serverTimestamp()
          });

          toast.success('Property marked as SOLD and transaction recorded!');
          setSelectedBuyerId('');
        } catch (error: any) {
          handleFirestoreError(error, OperationType.UPDATE, propertyPath);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !docFormData.propertyId || !docFormData.userId) {
      toast.error('Please select a property and user');
      return;
    }

    if (!docFormData.agreementURL && !docFormData.paperworkURL) {
      toast.error('Please provide at least one document URL');
      return;
    }
    
    setIsUploadingDoc(true);
    const path = 'documents';
    const toastId = 'doc-upload-toast';
    
    try {
      toast.loading('Saving documents...', { id: toastId });
      
      // Fetch property title and user email for denormalization
      const propertyDoc = await getDoc(doc(db, 'properties', docFormData.propertyId));
      const propertyTitle = propertyDoc.exists() ? (propertyDoc.data()?.title || 'Property') : 'Property';
      
      // Try to find user email and name from appointments or users collection
      let userEmail = 'N/A';
      let userName = 'Client';
      const userAppt = appointments.find(a => a.userId === docFormData.userId);
      if (userAppt && userAppt.userEmail) {
        userEmail = userAppt.userEmail;
      }
      
      const userProfile = allUsers.find(u => u.id === docFormData.userId);
      if (userProfile) {
        userName = userProfile.name || 'Client';
        if (userEmail === 'N/A') userEmail = userProfile.email || 'N/A';
      } else {
        const userDoc = await getDoc(doc(db, 'users', docFormData.userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userName = userData?.name || 'Client';
          if (userEmail === 'N/A') userEmail = userData?.email || 'N/A';
        }
      }

      const docQuery = query(
        collection(db, path),
        where('propertyId', '==', docFormData.propertyId),
        where('userId', '==', docFormData.userId)
      );
      const docSnap = await getDocs(docQuery);

      if (!docSnap.empty) {
        const updateData: any = {
          updatedAt: serverTimestamp(),
          agentId: user.uid,
          userName,
          userEmail
        };
        if (docFormData.agreementURL) updateData.agreementURL = docFormData.agreementURL;
        if (docFormData.paperworkURL) updateData.paperworkURL = docFormData.paperworkURL;
        
        await updateDoc(doc(db, path, docSnap.docs[0].id), updateData);
      } else {
        await addDoc(collection(db, path), {
          propertyId: docFormData.propertyId,
          userId: docFormData.userId,
          agentId: user.uid,
          agreementURL: docFormData.agreementURL,
          paperworkURL: docFormData.paperworkURL,
          propertyTitle,
          userEmail,
          userName,
          createdAt: serverTimestamp()
        });
      }

      toast.success('Documents saved successfully!', { id: toastId });
      setDocFormData({ propertyId: '', userId: '', agreementURL: '', paperworkURL: '' });
      
    } catch (error: any) {
      console.error('Document save error:', error);
      toast.error('Failed to save documents: ' + (error.message || 'Unknown error'), { id: toastId });
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleGenerateReport = async (tx: Transaction) => {
    if (!user) return;
    
    if (!tx.propertyId) {
      toast.error('Cannot generate report: Property ID is missing from transaction.');
      return;
    }

    setIsGeneratingReport(true);
    const toastId = toast.loading('Generating property report...', { id: 'report-toast' });
    
    try {
      console.log('Starting report generation for transaction:', tx.id);
      
      // 1. Create PDF
      let doc: jsPDF;
      try {
        doc = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
          putOnlyUsedFonts: true,
          floatPrecision: 16
        });
      } catch (pdfInitError) {
        console.error('Failed to initialize jsPDF:', pdfInitError);
        throw new Error('Failed to initialize PDF generator. Please check if the library is loaded correctly.');
      }
      
      // Header
      try {
        doc.setFillColor(10, 25, 47); // Navy
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(212, 175, 55); // Gold
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('PROPERTY TRANSACTION REPORT', 105, 25, { align: 'center' });
      } catch (headerError) {
        console.error('Error creating PDF header:', headerError);
      }
      
      // Content
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      let y = 60;
      const margin = 20;
      const lineHeight = 10;
      
      const addSection = (title: string, data: { label: string, value: string }[]) => {
        try {
          doc.setFont('helvetica', 'bold');
          doc.text(String(title).toUpperCase(), margin, y);
          y += 8;
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, y - 2, 190, y - 2);
          
          doc.setFont('helvetica', 'normal');
          data.forEach(item => {
            const label = String(item.label || 'N/A');
            const value = String(item.value || 'N/A');
            doc.text(`${label}:`, margin, y);
            doc.text(value, margin + 50, y);
            y += lineHeight;
          });
          y += 10;
        } catch (sectionError) {
          console.error(`Error adding section ${title}:`, sectionError);
          y += 10; // Try to skip and continue
        }
      };
      
      addSection('Property Information', [
        { label: 'Property Title', value: String(tx.propertyTitle || 'N/A') },
        { label: 'Property ID', value: String(tx.propertyId || 'N/A') },
        { label: 'Location', value: String(tx.country || 'N/A') },
        { label: 'Sale Price', value: `$${Number(tx.price || 0).toLocaleString()}` },
      ]);
      
      addSection('Client Information', [
        { label: 'Client Email', value: String(tx.userEmail || 'N/A') },
        { label: 'Client ID', value: String(tx.userId || tx.buyerId || 'N/A') },
      ]);
      
      addSection('Agent Information', [
        { label: 'Agent Name', value: String(profile?.name || 'N/A') },
        { label: 'Agent Email', value: String(user.email || 'N/A') },
        { label: 'Commission', value: `$${Number(tx.commission || 0).toLocaleString()}` },
      ]);
      
      addSection('Transaction Details', [
        { label: 'Transaction ID', value: String(tx.id || 'N/A') },
        { label: 'Date', value: String(formatDate(tx.createdAt)) },
      ]);
      
      // Footer
      try {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('This is a computer-generated document. No signature required.', 105, 280, { align: 'center' });
      } catch (footerError) {
        console.error('Error adding PDF footer:', footerError);
      }
      
      // 2. Download PDF directly
      console.log('Downloading PDF...');
      try {
        doc.save(`Property_Report_${tx.propertyTitle || 'Transaction'}_${Date.now()}.pdf`);
        toast.success('Report generated and downloaded successfully!', { id: 'report-toast' });
      } catch (saveError) {
        console.error('Error saving PDF:', saveError);
        toast.error('Failed to download report. Please try again.', { id: 'report-toast' });
      }
      
    } catch (error: any) {
      console.error('Error in handleGenerateReport:', error);
      toast.error('Failed to generate report: ' + (error.message || 'Unknown error'), { id: 'report-toast' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleUploadAgreement = async (tx: Transaction) => {
    if (!user) return;
    
    const url = prompt('Please enter the Agreement Google Drive / PDF URL:');
    if (!url) return;

    setUploadingAgreementId(tx.id);
    const toastId = 'agreement-upload-toast';
    toast.loading('Saving agreement URL...', { id: toastId });
    
    try {
      const targetUserId = tx.userId || tx.buyerId || 'anonymous';
      const propertyId = tx.propertyId || 'unknown';
      
      const docQuery = query(
        collection(db, 'documents'),
        where('propertyId', '==', propertyId),
        where('userId', '==', targetUserId)
      );
      const docSnap = await getDocs(docQuery);
      
      if (!docSnap.empty) {
        await updateDoc(doc(db, 'documents', docSnap.docs[0].id), {
          agreementURL: url,
          userName: tx.userName || 'Client',
          userEmail: tx.userEmail || 'N/A',
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'documents'), {
          propertyId,
          userId: targetUserId,
          agentId: user.uid,
          agreementURL: url,
          propertyTitle: tx.propertyTitle || 'Property Agreement',
          userEmail: tx.userEmail || 'N/A',
          userName: tx.userName || 'Client',
          createdAt: serverTimestamp()
        });
      }
      
      toast.success('Agreement URL saved successfully!', { id: toastId });
    } catch (error: any) {
      console.error('Error saving agreement URL:', error);
      toast.error('Failed to save agreement URL: ' + (error.message || 'Unknown error'), { id: toastId });
    } finally {
      setUploadingAgreementId(null);
    }
  };

  const handleUploadPaperwork = async (tx: Transaction) => {
    if (!user) return;
    
    const url = prompt('Please enter the Paperwork Google Drive / PDF URL:');
    if (!url) return;

    setUploadingPaperworkId(tx.id);
    const toastId = 'paperwork-upload-toast';
    toast.loading('Saving paperwork URL...', { id: toastId });
    
    try {
      const targetUserId = tx.userId || tx.buyerId || 'anonymous';
      const propertyId = tx.propertyId || 'unknown';
      
      const docQuery = query(
        collection(db, 'documents'),
        where('propertyId', '==', propertyId),
        where('userId', '==', targetUserId)
      );
      const docSnap = await getDocs(docQuery);
      
      if (!docSnap.empty) {
        await updateDoc(doc(db, 'documents', docSnap.docs[0].id), {
          paperworkURL: url,
          userName: tx.userName || 'Client',
          userEmail: tx.userEmail || 'N/A',
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'documents'), {
          propertyId,
          userId: targetUserId,
          agentId: user.uid,
          paperworkURL: url,
          propertyTitle: tx.propertyTitle || 'Additional Paperwork',
          userEmail: tx.userEmail || 'N/A',
          userName: tx.userName || 'Client',
          createdAt: serverTimestamp()
        });
      }
      
      toast.success('Paperwork URL saved successfully!', { id: toastId });
    } catch (error: any) {
      console.error('Error saving paperwork URL:', error);
      toast.error('Failed to save paperwork URL: ' + (error.message || 'Unknown error'), { id: toastId });
    } finally {
      setUploadingPaperworkId(null);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document Record',
      message: 'Are you sure you want to delete this document record? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        const path = `documents/${id}`;
        try {
          await deleteDoc(doc(db, 'documents', id));
          toast.success('Document record deleted');
        } catch (error: any) {
          console.error('Error deleting document record:', error);
          if (error.code === 'permission-denied') {
            toast.error('Permission denied. You can only delete your own document records.');
          } else {
            toast.error('Failed to delete document record: ' + (error.message || 'Unknown error'));
          }
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Analytics Data Preparation
  const getMonthlySalesData = () => {
    console.log('DEBUG: Fetched transactions:', transactions);
    
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString('default', { month: 'short' });
    }).reverse();

    const chartData = last6Months.map(monthName => {
      const monthlyTxs = transactions.filter(tx => {
        if (!tx.createdAt) return false;
        
        let txDate: Date;
        try {
          if (typeof tx.createdAt.toDate === 'function') {
            txDate = tx.createdAt.toDate();
          } else {
            txDate = new Date(tx.createdAt);
          }
        } catch (e) {
          txDate = new Date(tx.createdAt);
        }
        
        return !isNaN(txDate.getTime()) && txDate.toLocaleString('default', { month: 'short' }) === monthName;
      });

      const monthlyRevenue = monthlyTxs.reduce((sum, tx) => {
        const price = typeof tx.price === 'string' ? parseFloat(tx.price) : tx.price;
        return sum + (price || 0);
      }, 0);

      return {
        month: monthName,
        revenue: monthlyRevenue,
        count: monthlyTxs.length
      };
    });

    console.log('DEBUG: Grouped monthly data:', chartData);
    return chartData;
  };

  const getCountrySalesData = () => {
    const countries = [...new Set(transactions.map(tx => tx.country).filter(Boolean))];
    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    
    return countries.map((country, index) => ({
      name: country,
      value: transactions.filter(tx => tx.country === country).length,
      color: COLORS[index % COLORS.length]
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Agent Dashboard</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Manage your property listings and leads.</p>
        </div>
        <button
          onClick={() => isAdding ? resetForm() : setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-navy text-gold font-bold rounded-xl hover:bg-navy/90 transition-all shadow-lg border border-gold/20"
        >
          {isAdding ? <List className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isAdding ? 'View Listings' : 'Add New Listing'}
        </button>
      </div>

      {!isAdding && (
        <div className="flex gap-4 mb-8 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('listings')}
            className={cn(
              "px-4 py-2 font-bold text-sm transition-all border-b-2",
              activeTab === 'listings' ? "border-gold text-gold" : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            My Listings
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={cn(
              "px-4 py-2 font-bold text-sm transition-all border-b-2",
              activeTab === 'appointments' ? "border-gold text-gold" : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Appointments
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={cn(
              "px-4 py-2 font-bold text-sm transition-all border-b-2",
              activeTab === 'reviews' ? "border-gold text-gold" : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Reviews
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-4 py-2 font-bold text-sm transition-all border-b-2",
              activeTab === 'analytics' ? "border-gold text-gold" : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={cn(
              "px-4 py-2 font-bold text-sm transition-all border-b-2",
              activeTab === 'transactions' ? "border-gold text-gold" : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={cn(
              "px-4 py-2 font-bold text-sm transition-all border-b-2",
              activeTab === 'documents' ? "border-gold text-gold" : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Documents
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm"
          >
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-6">
              {editingId ? 'Edit Property' : 'Property Details'}
            </h2>
            <form onSubmit={handleSubmit} className="relative space-y-8">
              {/* Submission Progress Overlay */}
              <AnimatePresence>
                {isSubmitting && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-2xl"
                  >
                    <div className="w-full max-w-md p-8 text-center space-y-6">
                      <div className="relative inline-block">
                        <Loader2 className="w-16 h-16 text-gold animate-spin mx-auto" />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white capitalize">
                          {submissionStep === 'saving' ? 'Saving Property Details...' : 
                           submissionStep === 'completed' ? 'Listing Published!' : 'Processing...'}
                        </h3>
                        <p className="text-neutral-500 text-sm">
                          {submissionStep === 'saving' ? 'Finalizing your listing and updating the global property database.' : 
                           submissionStep === 'completed' ? 'Your property is now live and visible to potential buyers.' : 'Please wait while we process your request.'}
                        </p>
                      </div>

                      {submissionStep === 'completed' && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center justify-center gap-2 text-green-500 font-bold"
                        >
                          <Check className="w-6 h-6" />
                          <span>Success!</span>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Basic Information</h3>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Title</label>
                    <input
                      type="text"
                      name="title"
                      required
                      value={formData.title}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                      placeholder="Luxury Villa in Beverly Hills"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Type</label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                      >
                        <option value="flat">Flat</option>
                        <option value="villa">Villa</option>
                        <option value="plot">Plot</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Status</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                      >
                        <option value="available">Available</option>
                        <option value="sold">Sold</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Price ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="number"
                        name="price"
                        required
                        value={formData.price}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                        placeholder="1500000"
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Location</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Country</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input
                          type="text"
                          name="country"
                          required
                          value={formData.country}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                          placeholder="USA"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">City</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input
                          type="text"
                          name="city"
                          required
                          value={formData.city}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                          placeholder="Los Angeles"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Area / Neighborhood</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="text"
                        name="area"
                        value={formData.area}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                        placeholder="Beverly Hills"
                      />
                    </div>
                  </div>
                </div>

                {/* Coordinates */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Map Coordinates</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        name="lat"
                        value={formData.lat}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                        placeholder="34.0736"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        name="lng"
                        value={formData.lng}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                        placeholder="-118.4004"
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Features & Size</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Beds</label>
                      <div className="relative">
                        <Bed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input
                          type="number"
                          name="bedrooms"
                          value={formData.bedrooms}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                          placeholder="4"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Baths</label>
                      <div className="relative">
                        <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input
                          type="number"
                          name="bathrooms"
                          value={formData.bathrooms}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                          placeholder="3"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Sqft</label>
                      <div className="relative">
                        <Maximize className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input
                          type="number"
                          name="sqft"
                          value={formData.sqft}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                          placeholder="2500"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Virtual Tour URL</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="url"
                        name="virtualTourURL"
                        value={formData.virtualTourURL}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white"
                        placeholder="https://matterport.com/..."
                      />
                    </div>
                  </div>
                </div>

                {/* Media */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Property Images (URLs)</h3>
                    <button
                      type="button"
                      onClick={addImageUrlField}
                      className="text-xs font-bold text-gold hover:text-gold/80 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add More
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="relative flex-1">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                          <input
                            type="url"
                            value={url}
                            onChange={(e) => handleImageUrlChange(index, e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white text-sm"
                            placeholder="https://images.unsplash.com/photo-..."
                          />
                        </div>
                        {imageUrls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeImageUrlField(index)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Image Preview */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-4">
                    {imageUrls.map((url, i) => url.trim() && (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800">
                        <img 
                          src={url} 
                          alt={`Preview ${i + 1}`} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Description</label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-gold outline-none dark:text-white resize-none"
                  placeholder="Describe the property's features, amenities, and unique selling points..."
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-8 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-12 py-3 bg-navy text-gold font-bold rounded-xl hover:bg-navy/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg border border-gold/20"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {editingId ? 'Update Listing' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : activeTab === 'transactions' ? (
          <motion.div
            key="transactions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Recent Transactions</h3>
                  <p className="text-sm text-neutral-500">Manage agreements and paperwork for your sales.</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  {transactions.length} Total Sales
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Property</th>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-neutral-900 dark:text-white">{tx.propertyTitle}</span>
                            <span className="text-xs text-neutral-500">{tx.country}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-neutral-900 dark:text-white">{tx.userName}</span>
                            <span className="text-xs text-neutral-500">{tx.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gold">${tx.price.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-neutral-500">{formatDate(tx.createdAt)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              onClick={() => handleUploadAgreement(tx)}
                              disabled={uploadingAgreementId === tx.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-navy text-gold text-[10px] font-bold rounded-lg hover:bg-navy/90 transition-all disabled:opacity-50 min-w-[120px] justify-center"
                            >
                              {uploadingAgreementId === tx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              Agreement
                            </button>
                            <button
                              onClick={() => handleUploadPaperwork(tx)}
                              disabled={uploadingPaperworkId === tx.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800 text-white text-[10px] font-bold rounded-lg hover:bg-neutral-700 transition-all disabled:opacity-50 min-w-[120px] justify-center"
                            >
                              {uploadingPaperworkId === tx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              Paperwork
                            </button>
                            <button
                              onClick={() => handleGenerateReport(tx)}
                              disabled={isGeneratingReport}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold text-navy text-[10px] font-bold rounded-lg hover:bg-gold/90 transition-all disabled:opacity-50 min-w-[120px] justify-center"
                            >
                              {isGeneratingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                              Report
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <TrendingUp className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                          <p className="text-neutral-500">No transactions recorded yet.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'documents' ? (
          <motion.div
            key="documents"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Upload Form */}
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                <Upload className="w-5 h-5 text-gold" />
                Upload Property Documents
              </h3>
              <form onSubmit={handleDocUpload} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Select Property</label>
                    <select
                      value={docFormData.propertyId}
                      onChange={(e) => setDocFormData(prev => ({ ...prev, propertyId: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-gold dark:text-white"
                      required
                    >
                      <option value="">Choose a property...</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Select Client (User)</label>
                    <select
                      value={docFormData.userId}
                      onChange={(e) => setDocFormData(prev => ({ ...prev, userId: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-gold dark:text-white"
                      required
                    >
                      <option value="">Choose a client...</option>
                      {/* Combine all potential clients: users with role 'USER', and those from transactions/appointments */}
                      {(() => {
                        const potentialClientIds = new Set<string>();
                        
                        // 1. Add all users with role 'USER'
                        allUsers.filter(u => u.role === 'USER').forEach(u => potentialClientIds.add(u.id));
                        
                        // 2. Add users from transactions (especially for this property)
                        transactions
                          .filter(tx => !docFormData.propertyId || tx.propertyId === docFormData.propertyId)
                          .forEach(tx => {
                            if (tx.buyerId) potentialClientIds.add(tx.buyerId);
                            if (tx.userId) potentialClientIds.add(tx.userId);
                          });
                          
                        // 3. Add users from appointments for this property
                        appointments
                          .filter(app => !docFormData.propertyId || app.propertyId === docFormData.propertyId)
                          .forEach(app => {
                            if (app.userId) potentialClientIds.add(app.userId);
                          });

                        return Array.from(potentialClientIds).map(uid => {
                          const userProfile = allUsers.find(u => u.id === uid);
                          const txWithUser = transactions.find(tx => (tx.buyerId || tx.userId) === uid);
                          const apptWithUser = appointments.find(app => app.userId === uid);
                          
                          // Prioritize name, then email, then ID
                          const displayName = userProfile?.name || txWithUser?.userName || apptWithUser?.userName || userProfile?.email || txWithUser?.userEmail || apptWithUser?.userEmail || uid;
                          
                          return (
                            <option key={uid} value={uid}>{displayName}</option>
                          );
                        });
                      })()}
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Agreement URL (Google Drive / PDF)</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={docFormData.agreementURL}
                      onChange={(e) => setDocFormData(prev => ({ ...prev, agreementURL: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-gold dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Additional Paperwork URL</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={docFormData.paperworkURL}
                      onChange={(e) => setDocFormData(prev => ({ ...prev, paperworkURL: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-gold dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUploadingDoc}
                    className="w-full py-3 bg-navy text-gold font-bold rounded-xl hover:bg-navy/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg border border-gold/20"
                  >
                    {isUploadingDoc ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    Save Document URLs
                  </button>
                </div>
              </form>
            </div>

            {/* Generate Report from Transaction */}
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gold" />
                Generate Property Report
              </h3>
              <p className="text-sm text-neutral-500 mb-6">
                Quickly generate a professional PDF report for a completed transaction and upload it for the client.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Property</th>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {transactions.slice(0, 5).map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-neutral-900 dark:text-white">{tx.propertyTitle}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-neutral-900 dark:text-white">{tx.userName}</span>
                            <span className="text-xs text-neutral-500">{tx.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gold">${tx.price.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col gap-2 items-end">
                            <button
                              onClick={() => handleGenerateReport(tx)}
                              disabled={isGeneratingReport}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-navy text-xs font-bold rounded-lg hover:bg-gold/90 transition-all disabled:opacity-50 w-40 justify-center"
                            >
                              {isGeneratingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                              Property Report
                            </button>
                            <button
                              onClick={() => handleUploadAgreement(tx)}
                              disabled={uploadingAgreementId === tx.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-gold text-xs font-bold rounded-lg hover:bg-navy/90 transition-all disabled:opacity-50 w-40 justify-center"
                            >
                              {uploadingAgreementId === tx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              Upload Agreement
                            </button>
                            <button
                              onClick={() => handleUploadPaperwork(tx)}
                              disabled={uploadingPaperworkId === tx.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white text-xs font-bold rounded-lg hover:bg-neutral-700 transition-all disabled:opacity-50 w-40 justify-center"
                            >
                              {uploadingPaperworkId === tx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              Upload Paperwork
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-neutral-500 italic text-sm">
                          No transactions found to generate reports from.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Documents List */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Uploaded Documents</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Property</th>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Files</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-neutral-900 dark:text-white">{doc.propertyTitle}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-neutral-900 dark:text-white">{doc.userName}</span>
                            <span className="text-xs text-neutral-500">{doc.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {doc.agreementURL && (
                              <a
                                href={doc.agreementURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-navy/10 text-navy dark:text-gold rounded-lg hover:bg-navy/20 transition-all"
                                title="Download Agreement"
                              >
                                <FileText className="w-4 h-4" />
                              </a>
                            )}
                            {doc.paperworkURL && (
                              <a
                                href={doc.paperworkURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-200 transition-all"
                                title="Download Paperwork"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-neutral-500">{formatDate(doc.createdAt)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {documents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <FileText className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                          <p className="text-neutral-500">No documents uploaded yet.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'listings' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
                <p className="text-neutral-500">Loading your listings...</p>
              </div>
            ) : properties.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {properties.map((property) => (
                  <div
                    key={property.id}
                    className="flex flex-col sm:flex-row items-center gap-6 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="w-full sm:w-48 h-32 bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden flex-shrink-0">
                      <img
                        src={property.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop'}
                        alt={property.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
                          {property.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase",
                            property.status === 'available' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {property.status}
                          </span>
                          <span className="text-gold font-bold">
                            ${property.price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 text-sm mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>{property.city}, {property.country}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-neutral-400">
                        <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {property.bedrooms} Beds</span>
                        <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {property.bathrooms} Baths</span>
                        <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> {property.sqft} Sqft</span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {property.virtualTourURL && (
                        <button
                          onClick={() => {
                            setSelectedTour({ url: property.virtualTourURL, title: property.title });
                            setShowTourModal(true);
                          }}
                          className="flex-1 sm:flex-none p-3 text-navy dark:text-gold hover:bg-navy/10 rounded-xl transition-colors"
                          title="View Virtual Tour"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                      )}
                      {property.status === 'available' && (
                        <button
                          onClick={() => handleMarkAsSold(property)}
                          className="flex-1 sm:flex-none p-3 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                          title="Mark as Sold"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(property)}
                        className="flex-1 sm:flex-none p-3 text-gold hover:bg-gold/10 rounded-xl transition-colors"
                        title="Edit Listing"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(property.id)}
                        className="flex-1 sm:flex-none p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        title="Delete Listing"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800">
                <Home className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">No listings yet</h3>
                <p className="text-neutral-500 mb-6">Start growing your portfolio by adding your first property.</p>
                <button
                  onClick={() => setIsAdding(true)}
                  className="px-6 py-2 bg-navy text-gold font-bold rounded-lg hover:bg-navy/90 transition-all border border-gold/20"
                >
                  Create Listing
                </button>
              </div>
            )}
          </motion.div>
        ) : activeTab === 'appointments' ? (
          <motion.div
            key="appointments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {appointments.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {appointments.map((appointment) => {
                  const property = properties.find(p => p.id === appointment.propertyId);
                  return (
                    <div
                      key={appointment.id}
                      className="flex flex-col sm:flex-row items-center gap-6 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm"
                    >
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                              {property?.title || 'Unknown Property'}
                            </h3>
                            <p className="text-sm text-neutral-500">
                              Requested by: {appointment.userEmail || 'User'}
                            </p>
                          </div>
                          <span className={cn(
                            "px-3 py-1 text-xs font-bold rounded-full uppercase",
                            appointment.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                            appointment.status === 'approved' ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {appointment.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">
                            {new Date(appointment.date).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {appointment.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateAppointmentStatus(appointment.id, 'approved')}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(appointment.id, 'rejected')}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800">
                <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">No appointments</h3>
                <p className="text-neutral-500">You don't have any viewing requests yet.</p>
              </div>
            )}
          </motion.div>
        ) : activeTab === 'reviews' ? (
          <motion.div
            key="reviews"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {reviews.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {reviews.map((review) => {
                  const property = properties.find(p => p.id === review.propertyId);
                  return (
                    <div
                      key={review.id}
                      className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-neutral-900 dark:text-white">
                            {property?.title || 'Unknown Property'}
                          </h3>
                          <p className="text-sm text-neutral-500">By {review.userName}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-4 h-4",
                                i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-300"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-neutral-700 dark:text-neutral-300 italic">
                        "{review.comment}"
                      </p>
                      <p className="text-xs text-neutral-400 mt-4">
                        {formatDate(review.createdAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800">
                <Star className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">No reviews yet</h3>
                <p className="text-neutral-500">Reviews from your clients will appear here.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="analytics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gold/5 dark:bg-gold/10 rounded-xl">
                    <Home className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Total Properties</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white">{properties.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Sold Properties</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {properties.filter(p => p.status === 'sold').length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Total Sales</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                      ${transactions.reduce((sum, tx) => sum + tx.price, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Total Commission</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                      ${transactions.reduce((sum, tx) => sum + tx.commission, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Monthly Sales Chart */}
              <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gold" />
                    Monthly Sales Revenue
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getMonthlySalesData()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={3} dot={{ r: 4, fill: '#D4AF37', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Country Sales Chart */}
              <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-gold" />
                    Sales by Country
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getCountrySalesData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {getCountrySalesData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-gold" />
                  Recent Transactions
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Property</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Country</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Commission</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">{tx.propertyTitle}</td>
                        <td className="px-6 py-4 text-sm text-neutral-500">{tx.country}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gold">${tx.price.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium">${tx.commission.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(tx.createdAt)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleGenerateReport(tx)}
                              disabled={isGeneratingReport}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold/10 text-gold text-xs font-bold rounded-lg hover:bg-gold/20 transition-all disabled:opacity-50"
                              title="Generate and Upload Property Report"
                            >
                              {isGeneratingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                              Report
                            </button>
                            <button
                              onClick={() => handleUploadAgreement(tx)}
                              disabled={uploadingAgreementId === tx.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-navy/10 text-navy dark:text-gold text-xs font-bold rounded-lg hover:bg-navy/20 transition-all disabled:opacity-50"
                              title="Upload Manual Agreement"
                            >
                              {uploadingAgreementId === tx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              Agreement
                            </button>
                            <button
                              onClick={() => handleUploadPaperwork(tx)}
                              disabled={uploadingPaperworkId === tx.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800/10 text-neutral-800 dark:text-white text-xs font-bold rounded-lg hover:bg-neutral-800/20 transition-all disabled:opacity-50"
                              title="Upload Manual Additional Paperwork"
                            >
                              {uploadingPaperworkId === tx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              Paperwork
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 italic">
                          No transactions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-neutral-200 dark:border-neutral-800"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${
                  confirmDialog.variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  confirmDialog.variant === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {confirmDialog.title}
                </h3>
              </div>
              
              <p className="text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
                {confirmDialog.message}
              </p>

              {confirmDialog.title === 'Mark as Sold' && (
                <div className="mb-8">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Select Buyer</label>
                  <select
                    value={selectedBuyerId}
                    onChange={(e) => setSelectedBuyerId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-gold dark:text-white"
                  >
                    <option value="">Choose a buyer...</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {confirmDialog.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  disabled={confirmDialog.title === 'Mark as Sold' && !selectedBuyerId}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    confirmDialog.variant === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                    confirmDialog.variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' :
                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  {confirmDialog.confirmText || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <VirtualTourViewer
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        url={selectedTour?.url || ''}
        title={selectedTour?.title || ''}
      />
    </div>
  );
};
