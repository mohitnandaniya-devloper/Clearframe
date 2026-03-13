import { ArrowRight, Lock, User, ShieldCheck, Shield, Cloud, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import type { ConnectBrokerCredentials } from "@/lib/api/brokers";

const formSchema = z.object({
  clientCode: z.string().min(1, "Client code is required"),
  password: z.string().min(1, "Password is required"),
  totp: z
    .string()
    .length(6, "TOTP must be exactly 6 digits")
    .regex(/^\d+$/, "TOTP must contain only numbers"),
});

type FormValues = z.infer<typeof formSchema>;

interface BrokerLoginFormProps {
  brokerName: string;
  onBack: () => void;
  onSubmit: (credentials: ConnectBrokerCredentials) => void;
  isConnecting?: boolean;
}

export function BrokerLoginForm({ brokerName, onBack, onSubmit, isConnecting }: BrokerLoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientCode: "",
      password: "",
      totp: "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    onSubmit({
      clientCode: values.clientCode,
      password: values.password,
      totp: values.totp,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#2B4E44] bg-[#102825] shadow-[0_28px_70px_rgba(0,0,0,0.28)]"
    >
      <button
        aria-label="Go back"
        onClick={onBack}
        type="button"
        className="absolute left-6 top-6 p-2 text-[#FFFFFFB3] hover:text-[#C4E456] hover:bg-[#2B4E44] rounded-full transition-all group z-10"
      >
        <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
      </button>

      {/* Card Header */}
      <div className="border-b border-[#2B4E44]/70 px-6 pb-5 pt-8 text-center md:px-8">
        <div className="mb-5 inline-flex size-14 items-center justify-center rounded-full border border-[#2B4E44] bg-[#0B201F] text-[#C4E456]">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-[24px] md:text-[32px] font-medium text-[#F6F9F2] mb-2 tracking-tight leading-tight">
          Log in to {brokerName}
        </h1>
        <p className="text-[#FFFFFFB3] text-sm leading-relaxed max-w-[320px] mx-auto">
          Enter your details below to securely connect your account.
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form
          className="space-y-4 px-6 pb-6 pt-6 md:px-10"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          {/* Client Code Field */}
          <FormField
            control={form.control}
            name="clientCode"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm font-medium text-[#F6F9F2] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#C4E456]" />
                  Client ID
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="w-full px-4 py-3 h-auto rounded-xl border-[#2B4E44] bg-[#0B201F]/50 text-[#F6F9F2] focus-visible:ring-2 focus-visible:ring-[#C4E456]/40 focus-visible:border-[#C4E456] transition-all placeholder:text-[#FFFFFFB3]/50 text-base"
                    placeholder="Enter your Client ID"
                    disabled={isConnecting}
                  />
                </FormControl>
                <FormMessage className="text-[#EB316F] text-xs" />
              </FormItem>
            )}
          />

          {/* PIN / Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm font-medium text-[#F6F9F2] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#C4E456]" />
                  PIN or Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-3 pr-10 h-auto rounded-xl border-[#2B4E44] bg-[#0B201F]/50 text-[#F6F9F2] focus-visible:ring-2 focus-visible:ring-[#C4E456]/40 focus-visible:border-[#C4E456] transition-all placeholder:text-[#FFFFFFB3]/50 text-base"
                      placeholder="Enter your PIN or password"
                      disabled={isConnecting}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFFFFFB3] hover:text-[#F6F9F2] transition-colors p-1"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[#EB316F] text-xs" />
              </FormItem>
            )}
          />

          {/* TOTP Field */}
          <FormField
            control={form.control}
            name="totp"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm font-medium text-[#F6F9F2] flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#C4E456]" />
                  Authenticator App Code
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={6}
                    className="w-full px-4 py-3 h-auto rounded-xl border-[#2B4E44] bg-[#0B201F]/50 text-[#F6F9F2] focus-visible:ring-2 focus-visible:ring-[#C4E456]/40 focus-visible:border-[#C4E456] transition-all placeholder:text-[#FFFFFFB3]/50 text-base tracking-widest"
                    placeholder="• • • • • •"
                    disabled={isConnecting}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      field.onChange(val);
                    }}
                  />
                </FormControl>
                <p className="text-[11px] md:text-xs text-[#FFFFFFB3]/70 pt-1">
                  Enter the 6-digit code from your authenticator app.
                </p>
                <FormMessage className="text-[#EB316F] text-xs" />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isConnecting}
            className="w-full mt-6 h-12 md:h-14 bg-[#C4E456] hover:bg-[#C4E456]/90 text-[#0B201F] font-medium rounded-xl shadow-[0_4px_20px_rgb(196,228,86,0.15)] transition-all flex items-center justify-center gap-2 group text-[16px]"
          >
            <span>{isConnecting ? "Connecting securely..." : `Connect ${brokerName}`}</span>
            {!isConnecting && <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1.5" />}
          </Button>

          <div className="pt-4 text-center">
            <p className="text-xs text-[#FFFFFFB3]">
              Need help logging in? <a className="text-[#8CFCBA] hover:text-[#C4E456] hover:underline transition-colors font-medium ml-1" href="#">Contact Support</a>
            </p>
          </div>
        </form>
      </Form>

      {/* Security Badges */}
      <div className="mx-4 mb-8 mt-2 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-[#2B4E44] bg-[#0B201F]/55 py-3 opacity-70 transition-all duration-500 hover:opacity-100 md:gap-6">
        <div className="flex items-center gap-1.5 text-[#FFFFFFB3] font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-xs">256-bit SSL</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#FFFFFFB3] font-medium">
          <Lock className="w-4 h-4" />
          <span className="text-xs">PCI Compliant</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#FFFFFFB3] font-medium">
          <Cloud className="w-4 h-4" />
          <span className="text-xs">Auto Sync</span>
        </div>
      </div>
    </motion.div>
  );
}
