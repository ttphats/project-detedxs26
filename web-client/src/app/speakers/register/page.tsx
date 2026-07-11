"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle, HelpCircle } from "lucide-react";

interface SpeakerField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number';
  is_required: boolean;
  placeholder: string | null;
  options: string | null;
  sort_order: number;
}

interface SpeakerConfig {
  title: string;
  description: string | null;
  rules: string[];
}

export default function RegisterSpeakerPage() {
  const [config, setConfig] = useState<SpeakerConfig | null>(null);
  const [fields, setFields] = useState<SpeakerField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch config & fields in parallel
        const [configRes, fieldsRes] = await Promise.all([
          fetch("/api/speakers/register/config"),
          fetch("/api/speakers/register/fields")
        ]);
        
        if (!configRes.ok) {
          throw new Error(`Config HTTP error! status: ${configRes.status}`);
        }
        if (!fieldsRes.ok) {
          throw new Error(`Fields HTTP error! status: ${fieldsRes.status}`);
        }
        
        const configData = await configRes.json();
        const fieldsData = await fieldsRes.json();

        if (configData.success) {
          setConfig(configData.data);
        }
        if (fieldsData.success) {
          const sortedFields = (fieldsData.data || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
          setFields(sortedFields);
          
          // Pre-populate form state keys
          const initialForm: Record<string, any> = {};
          sortedFields.forEach((f: SpeakerField) => {
            initialForm[f.name] = "";
          });
          setFormData(initialForm);
        }
      } catch (error) {
        console.error("Failed to load registration data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear error on type
    if (formErrors[fieldName]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    fields.forEach((f) => {
      const val = formData[f.name];
      if (f.is_required && (!val || String(val).trim() === "")) {
        errors[f.name] = `${f.label} is required`;
      } else if (val) {
        if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
          errors[f.name] = "Invalid email format";
        } else if (f.type === 'phone' && !/^[0-9+() -]{9,15}$/.test(String(val))) {
          errors[f.name] = "Invalid phone number format";
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      const firstErrorField = fields.find(f => formErrors[f.name]);
      if (firstErrorField) {
        document.getElementById(`field-${firstErrorField.name}`)?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/speakers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        alert(data.error || "Failed to submit application. Please try again!");
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("Connection error. Please check your network connection!");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading registration form...</p>
        </div>
      </div>
    );
  }

  const title = config?.title || "Register to Become a Speaker - TEDxFPTUniversityHCMC";
  const description = config?.description || "TEDx is a great opportunity to share valuable ideas with the community.";
  const rules = config?.rules || [];

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Neon Blobs */}
      <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Minimalist Top Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-white font-black text-xl sm:text-2xl uppercase tracking-tight">
              TED<span className="text-red-600">x</span>
            </span>
            <span className="text-gray-400 text-xs sm:text-sm font-medium tracking-wide">FPTUniversityHCMC</span>
          </Link>

          {/* Back to Home Button */}
          <Link href="/">
            <button className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-red-600/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 text-xs sm:text-sm font-bold tracking-wide group shine-effect">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Back</span>
            </button>
          </Link>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">

        {submitted ? (
          /* Success Screen */
          <div className="glass-panel border border-green-500/30 rounded-3xl p-8 sm:p-12 text-center shadow-[0_0_50px_rgba(34,197,94,0.1)] animate-scale-in">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6 animate-bounce" />
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">
              Submission Successful!
            </h2>
            <p className="text-gray-300 max-w-lg mx-auto text-base sm:text-lg mb-8 leading-relaxed">
              Thank you for registering to become a speaker at TEDxFPTUniversityHCMC 2026. The organizing committee has received your details and will get back to you via email as soon as possible after reviewing your ideas!
            </p>
            <Link href="/">
              <button className="px-8 py-3 bg-green-500 text-white font-bold uppercase tracking-wider rounded-full hover:bg-green-600 hover:shadow-lg transition-all mobile-tap-feedback">
                Back to Home
              </button>
            </Link>
          </div>
        ) : (
          /* Form & Rules Screen */
          <div className="space-y-12">
            
            {/* Header Title */}
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none text-white mb-4">
                {title.split(" ").slice(0, -1).join(" ")}{" "}
                <span className="text-red-600">{title.split(" ").slice(-1)[0]}</span>
              </h1>
              <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed">
                {description}
              </p>
            </div>

            {/* Rules Section (The le/Dieu kien) */}
            {rules.length > 0 && (
              <div className="glass-panel border border-red-500/20 rounded-2xl p-6 sm:p-8 shadow-[0_0_30px_rgba(230,43,30,0.05)]">
                <h3 className="text-lg font-black uppercase text-red-500 tracking-wider mb-4 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" /> Rules & Regulations
                </h3>
                <ul className="space-y-3.5">
                  {rules.map((rule, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-gray-300 leading-relaxed items-start">
                      <span className="text-red-500 font-black text-sm">{idx + 1}.</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Form Section */}
            <div className="glass-panel border border-white/10 rounded-2xl p-6 sm:p-8">
              <h3 className="text-lg font-black uppercase tracking-wider text-white mb-6 border-b border-white/10 pb-4">
                Application Form
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                {fields.map((f) => {
                  const hasError = !!formErrors[f.name];
                  
                  return (
                    <div key={f.id} id={`field-${f.name}`} className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-300">
                        {f.label}{" "}
                        {f.is_required && (
                          <span className="text-red-500" title="Required">*</span>
                        )}
                      </label>
                      
                      {f.type === 'textarea' ? (
                        <textarea
                          value={formData[f.name] || ""}
                          onChange={(e) => handleInputChange(f.name, e.target.value)}
                          placeholder={f.placeholder || `Enter your ${f.label.toLowerCase()}...`}
                          rows={5}
                          className={`w-full bg-zinc-950/60 border rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all ${
                            hasError ? 'border-red-600 ring-1 ring-red-600' : 'border-white/10'
                          }`}
                        />
                      ) : (
                        <input
                          type={f.type === 'phone' ? 'text' : f.type}
                          value={formData[f.name] || ""}
                          onChange={(e) => handleInputChange(f.name, e.target.value)}
                          placeholder={f.placeholder || `Enter your ${f.label.toLowerCase()}...`}
                          className={`w-full bg-zinc-950/60 border rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all ${
                            hasError ? 'border-red-600 ring-1 ring-red-600' : 'border-white/10'
                          }`}
                        />
                      )}
                      
                      {hasError && (
                        <p className="text-red-500 text-xs mt-1">{formErrors[f.name]}</p>
                      )}
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-white/5">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full group relative px-6 py-3.5 bg-red-600 text-white font-bold uppercase tracking-wider rounded-xl overflow-hidden hover:bg-red-500 shadow-lg shadow-red-500/20 disabled:opacity-55 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mobile-tap-feedback"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
