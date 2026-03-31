import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles, Home, MapPin, DollarSign, TrendingUp, Search, Mic, MicOff, Volume2, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";
import { cn } from '../lib/utils';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface Property {
  id: string;
  title: string;
  price: number;
  type: string;
  area: string;
  city: string;
  country: string;
  growthPrediction?: string;
}

interface AIAssistantProps {
  properties: Property[];
  savedSearches?: any[];
  wishlistIds?: string[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ properties, savedSearches, wishlistIds }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: "Hi! I'm your AI Real Estate Assistant. Ask me anything about our listings, market trends, or your saved properties!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US'; 

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        // Automatically send if it's a voice command? 
        // For now, just set input so user can review.
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please enable permissions in your browser settings and ensure the app is allowed to use the microphone.");
        } else if (event.error === 'no-speech') {
          // Silently handle no-speech, just reset the state
          console.log("No speech detected.");
        } else {
          toast.error(`Speech recognition failed: ${event.error}. Please try again.`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast.error("Speech recognition is not supported in this browser.");
        return;
      }
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const speakResponse = async (text: string, retryCount = 0) => {
    if (isSpeaking && !retryCount) {
      audioRef.current?.pause();
      setIsSpeaking(false);
    }
    
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch (error: any) {
      console.error("TTS Error:", error);
      
      // Retry for internal errors (500)
      if (retryCount < 2 && (error.message?.includes('500') || error.status === 'INTERNAL')) {
        console.log(`Retrying TTS... Attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        return speakResponse(text, retryCount + 1);
      }
      
      setIsSpeaking(false);
      // Only show toast if it's not a transient error we're retrying
      if (retryCount >= 2) {
        toast.error("Voice output is temporarily unavailable.");
      }
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const checkAvailability = async (propertyId: string, date: string) => {
    try {
      const q = query(
        collection(db, 'appointments'),
        where('propertyId', '==', propertyId),
        where('date', '>=', date + 'T00:00:00'),
        where('date', '<=', date + 'T23:59:59')
      );
      const snapshot = await getDocs(q);
      // Simple logic: if less than 3 appointments, it's available
      return snapshot.size < 3;
    } catch (error) {
      console.error("Availability check failed:", error);
      return false;
    }
  };

  const bookAppointment = async (propertyId: string, date: string, time: string) => {
    if (!auth.currentUser) throw new Error("User not authenticated");
    
    // Find the property to get the agentId
    const property = properties.find(p => p.id === propertyId);
    if (!property) throw new Error("Property not found");

    try {
      const appointmentDate = `${date}T${time}:00`;
      const appointmentRef = await addDoc(collection(db, 'appointments'), {
        propertyId,
        userId: auth.currentUser.uid,
        agentId: (property as any).agentId || 'default-agent',
        date: appointmentDate,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Create alert for agent
      await addDoc(collection(db, 'alerts'), {
        userId: (property as any).agentId || 'default-agent',
        type: 'appointment_update',
        message: `New AI-assisted viewing request for "${property.title}"`,
        read: false,
        createdAt: serverTimestamp(),
        relatedId: propertyId
      });

      return { success: true, message: `Viewing booked for ${date} at ${time}` };
    } catch (error) {
      console.error("Booking failed:", error);
      return { success: false, message: "Failed to book appointment" };
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const checkAvailabilityTool: FunctionDeclaration = {
        name: "checkAvailability",
        description: "Check if an agent is available for a viewing on a specific date. Returns true if available, false otherwise.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            propertyId: { type: Type.STRING, description: "The unique ID of the property listing." },
            date: { type: Type.STRING, description: "The date for the viewing in YYYY-MM-DD format." }
          },
          required: ["propertyId", "date"]
        }
      };

      const bookViewingTool: FunctionDeclaration = {
        name: "bookViewing",
        description: "Finalize and book a property viewing appointment after confirming availability and time with the user.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            propertyId: { type: Type.STRING, description: "The unique ID of the property listing." },
            date: { type: Type.STRING, description: "The confirmed date in YYYY-MM-DD format." },
            time: { type: Type.STRING, description: "The confirmed time in HH:MM (24-hour) format." }
          },
          required: ["propertyId", "date", "time"]
        }
      };

      // Prepare context for the AI
      const context = `
        You are a high-end Real Estate Concierge for a luxury property platform. 
        
        Available Properties: ${JSON.stringify(properties.map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          location: `${p.area}, ${p.city}, ${p.country}`
        })))}
        
        Current System Date: ${new Date().toLocaleDateString()}
        Current System Time: ${new Date().toLocaleTimeString()}
        
        GOALS:
        1. Help users find properties.
        2. Coordinate viewings seamlessly.
        3. Support multiple languages (Arabic, Hindi, Mandarin, French, Spanish, etc.).
        
        VIEWING COORDINATION PROTOCOL:
        - If a user expresses interest in seeing a property (e.g., "I want to see this", "Can I visit?"):
          a. Identify the property they are interested in.
          b. Ask for their preferred date if not provided.
          c. Use 'checkAvailability' to verify the date.
          d. If available, propose 2-3 specific time slots (e.g., 10:00 AM, 2:00 PM, 4:30 PM).
          e. Once the user picks a time, use 'bookViewing' to finalize the appointment.
        - If they use relative dates like "Saturday morning", calculate the actual date based on the current system date.
        
        MULTILINGUAL & VOICE:
        - Detect the user's language and respond in that same language.
        - Your responses will be read aloud, so keep them conversational and clear.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: context }] },
          ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMsg }] }
        ],
        config: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          tools: [{ functionDeclarations: [checkAvailabilityTool, bookViewingTool] }]
        }
      });

      // Handle Function Calls
      const functionCalls = response.functionCalls;
      let finalResponseText = response.text || "";

      if (functionCalls) {
        const toolResults = [];
        for (const call of functionCalls) {
          if (call.name === 'checkAvailability') {
            const isAvailable = await checkAvailability(call.args.propertyId as string, call.args.date as string);
            toolResults.push({
              name: call.name,
              id: call.id,
              response: { available: isAvailable }
            });
          } else if (call.name === 'bookViewing') {
            const result = await bookAppointment(call.args.propertyId as string, call.args.date as string, call.args.time as string);
            toolResults.push({
              name: call.name,
              id: call.id,
              response: result
            });
          }
        }

        // Send tool results back to model to get final text
        const finalResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            { role: 'user', parts: [{ text: context }] },
            ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
            { role: 'user', parts: [{ text: userMsg }] },
            { role: 'model', parts: response.candidates[0].content.parts },
            { role: 'user', parts: toolResults.map(r => ({
              functionResponse: {
                name: r.name,
                response: r.response
              }
            }))}
          ],
          config: {
            tools: [{ functionDeclarations: [checkAvailabilityTool, bookViewingTool] }]
          }
        });
        finalResponseText = finalResponse.text || "I've processed your request.";
      }

      const aiResponse = finalResponseText || "I'm sorry, I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
      
      // Auto-speak the response
      speakResponse(aiResponse);
    } catch (error) {
      console.error("AI Assistant Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-[350px] sm:w-[400px] h-[500px] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-navy text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold/20 rounded-xl">
                  <Sparkles className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gold">AI Assistant</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-neutral-400">Online & Ready</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50 dark:bg-neutral-950"
            >
              {messages.map((msg, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-tl-none shadow-sm"
                  )}>
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-neutral-400 mt-1 px-1">
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </span>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs italic">Thinking...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about properties, ROI, or trends..."
                  className="w-full pl-4 pr-24 py-3 bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={isSpeaking ? stopSpeaking : toggleListening}
                    className={cn(
                      "p-2 rounded-xl transition-colors",
                      isListening ? "bg-red-500 text-white animate-pulse" : 
                      isSpeaking ? "bg-gold text-navy" :
                      "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 hover:bg-neutral-300"
                    )}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : 
                     isSpeaking ? <Volume2 className="w-4 h-4 animate-bounce" /> :
                     <Mic className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { icon: <TrendingUp className="w-3 h-3" />, text: "ROI Analysis" },
                  { icon: <Calendar className="w-3 h-3" />, text: "Book Viewing" },
                  { icon: <Volume2 className="w-3 h-3" />, text: "Voice Chat" }
                ].map((tag, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(`Tell me about ${tag.text.toLowerCase()}`)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-500 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {tag.icon}
                    {tag.text}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300",
          isOpen ? "bg-white text-navy rotate-90" : "bg-navy text-gold"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900" />
        )}
      </motion.button>
    </div>
  );
};
