import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  SendHorizontal,
} from "lucide-react";
import * as THREE from "three";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildReplyMessage,
  buildWelcomeMessage,
  type ChatMessage,
  type DashboardChatbotHolding,
} from "./chatbot-logic";

export type { DashboardChatbotHolding } from "./chatbot-logic";

interface FloatingDashboardChatbotProps {
  accountName: string;
  holdings: DashboardChatbotHolding[];
  totalValue: number;
  investedValue: number;
  totalPnl: number;
  pnlPercentage: number;
  connectionLabel: string;
}

export function FloatingDashboardChatbot({
  accountName,
  holdings,
  totalValue,
  investedValue,
  totalPnl,
  pnlPercentage,
  connectionLabel,
}: FloatingDashboardChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const replyTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const welcomeMessage = useMemo(
    () =>
      buildWelcomeMessage({
        accountName,
        holdings,
        totalValue,
        investedValue,
        totalPnl,
        pnlPercentage,
        connectionLabel,
      }),
    [accountName, connectionLabel, holdings, investedValue, pnlPercentage, totalPnl, totalValue],
  );
  const messages = useMemo(() => [welcomeMessage, ...conversation], [conversation, welcomeMessage]);
  const topHolding = holdings[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isResponding, messages]);

  useEffect(() => {
    return () => {
      if (replyTimeoutRef.current !== null) {
        window.clearTimeout(replyTimeoutRef.current);
      }
    };
  }, []);

  const submitPrompt = (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt || isResponding) {
      return;
    }

    if (replyTimeoutRef.current !== null) {
      window.clearTimeout(replyTimeoutRef.current);
      replyTimeoutRef.current = null;
    }

    setIsOpen(true);
    setDraft("");
    setIsResponding(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
    };

    startTransition(() => {
      setConversation((current) => [...current, userMessage]);
    });

    replyTimeoutRef.current = window.setTimeout(() => {
      const assistantMessage = buildReplyMessage(prompt, {
        accountName,
        holdings,
        totalValue,
        investedValue,
        totalPnl,
        pnlPercentage,
        connectionLabel,
      });
      startTransition(() => {
        setConversation((current) => [...current, assistantMessage]);
      });
      setIsResponding(false);
      replyTimeoutRef.current = null;
    }, 650);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPrompt(draft);
  };

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex max-w-[calc(100vw-0.75rem)] flex-col items-end gap-1.5 md:bottom-4 md:right-4 md:max-w-[336px]">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
            className="pointer-events-auto flex max-h-[min(540px,calc(100vh-5rem))] w-[min(314px,calc(100vw-0.75rem))] flex-col overflow-hidden rounded-[20px] border border-[#2B4E44] bg-[radial-gradient(circle_at_top,_rgba(255,138,203,0.18),_transparent_34%),linear-gradient(180deg,rgba(17,43,39,0.98),rgba(8,21,20,0.99))] shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl md:w-[320px]"
          >
            <div className="shrink-0 border-b border-[#2B4E44] px-2.5 py-2">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-[#2B4E44] bg-[#0B201F]/80 p-1.5 text-[#FFFFFF99] transition-colors hover:border-[#416133] hover:text-[#F6F9F2]"
                  aria-label="Close chatbot"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#081514]/65 px-2.5 py-2.5">
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
              {isResponding ? (
                <div className="flex items-start gap-2.5">
                  <ChatbotAvatar size="md" active />
                  <div className="inline-flex items-center gap-1 rounded-[18px] border border-[#2B4E44] bg-[#102825] px-2.5 py-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#F59ACF]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#F59ACF] [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#F59ACF] [animation-delay:240ms]" />
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#2B4E44] p-1.5">
              <div className="flex items-center gap-2 rounded-[18px] border border-[#2B4E44] bg-[#091716]/92 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Ask about ${topHolding?.symbol ?? "your portfolio"}`}
                  className="h-8 flex-1 border-0 bg-transparent px-1.5 text-[12px] text-[#F6F9F2] placeholder:text-[#FFFFFF55] focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  className="h-8 w-8 shrink-0 rounded-full bg-[#F6F9F2] text-[#0B201F] hover:bg-[#FFFFFF]"
                  disabled={!draft.trim() || isResponding}
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="pointer-events-auto flex flex-col items-end gap-1"
      >
        {!isOpen ? (
          <motion.div
            animate={{
              boxShadow: [
                "0 0 0 rgba(245,154,207,0)",
                "0 0 26px rgba(245,154,207,0.28)",
                "0 0 0 rgba(245,154,207,0)",
              ],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="hidden rounded-full border border-[#FFD1EA]/35 bg-[linear-gradient(135deg,rgba(255,214,236,0.96),rgba(245,154,207,0.92))] px-2.5 py-1 text-[10px] font-semibold text-[#3C0E29] shadow-[0_14px_36px_rgba(245,154,207,0.34)] md:block"
          >
            Ask AI
          </motion.div>
        ) : null}
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="group relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-transparent p-0 transition-transform hover:-translate-y-1 md:h-[64px] md:w-[64px]"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse chatbot" : "Open chatbot"}
        >
          <MascotLauncherCanvas isOpen={isOpen} />
        </button>
      </motion.div>
    </div>
  );
}

function ChatbotAvatar({
  size = "sm",
  active = false,
}: {
  size?: "sm" | "md";
  active?: boolean;
}) {
  const wrapperClass = size === "md" ? "h-7 w-7" : "h-[26px] w-[26px]";

  return (
    <div
      className={`relative ${wrapperClass} overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_28%,rgba(255,207,231,0.28),rgba(245,154,207,0.08)_48%,transparent_72%)]`}
      aria-hidden="true"
    >
      <MascotLauncherCanvas isOpen={active} />
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-line rounded-[16px] rounded-br-md bg-[#C4E456] px-2.5 py-2 text-[12px] text-[#0B201F] shadow-[0_14px_30px_rgba(196,228,86,0.15)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <ChatbotAvatar />
      <div className="max-w-[86%] whitespace-pre-line rounded-[16px] rounded-tl-md border border-[#2B4E44] bg-[#102825] px-2.5 py-2 text-[12px] leading-5 text-[#F6F9F2]">
        {message.content}
      </div>
    </div>
  );
}

function MascotLauncherCanvas({ isOpen }: { isOpen: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(isOpen);

  useEffect(() => {
    activeRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const bounds = canvas.getBoundingClientRect();
    renderer.setSize(bounds.width || 72, bounds.height || 72, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0.2, 7.2);

    const ambientLight = new THREE.AmbientLight(0xfff6fb, 2.35);
    const keyLight = new THREE.DirectionalLight(0xfff9fe, 2.7);
    keyLight.position.set(3.5, 4, 5);
    const fillLight = new THREE.PointLight(0xff89cb, 11, 20);
    fillLight.position.set(-3, 2, 4);
    const rimLight = new THREE.PointLight(0xff74bf, 7, 18);
    rimLight.position.set(0, 3.2, 3.6);
    scene.add(ambientLight, keyLight, fillLight, rimLight);

    const mascot = new THREE.Group();
    const bodyGroup = new THREE.Group();
    mascot.add(bodyGroup);

    const mascotPink = "#ff78c5";
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: mascotPink,
      emissive: mascotPink,
      emissiveIntensity: 0.1,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.22,
      clearcoatRoughness: 0.3,
    });
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: "#fff5fb" });
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: "#2d1430" });
    const cheekMaterial = new THREE.MeshStandardMaterial({
      color: "#ff9fd3",
      transparent: true,
      opacity: 0.62,
    });
    const mouthMaterial = new THREE.MeshStandardMaterial({ color: "#4f1735" });
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: "#090f10",
      transparent: true,
      opacity: 0.22,
    });

    const topBody = new THREE.Mesh(new THREE.SphereGeometry(1.04, 48, 48), bodyMaterial);
    topBody.position.set(0, 0.48, 0);
    topBody.scale.set(1.08, 1.06, 1);
    bodyGroup.add(topBody);

    const lowerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.98, 0.82, 1.4, 48, 1, false),
      bodyMaterial,
    );
    lowerBody.position.set(0, -0.18, 0);
    lowerBody.scale.set(1, 1.02, 1);
    bodyGroup.add(lowerBody);

    const footGeometry = new THREE.SphereGeometry(0.34, 24, 24);
    [-0.56, 0, 0.56].forEach((x) => {
      const foot = new THREE.Mesh(footGeometry, bodyMaterial);
      foot.position.set(x, -0.95, 0);
      foot.scale.set(x === 0 ? 1 : 0.94, 1.18, 0.94);
      bodyGroup.add(foot);
    });

    [
      [-0.9, -0.45, 0.88],
      [0.92, -0.48, 0.82],
    ].forEach(([x, y, scaleY]) => {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 20), bodyMaterial);
      drip.position.set(x, y, 0.05);
      drip.scale.set(0.78, scaleY, 0.72);
      bodyGroup.add(drip);
    });

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), whiteMaterial);
    leftEye.position.set(-0.38, 0.55, 0.89);
    leftEye.scale.set(1, 1.2, 0.5);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.38;

    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 18), pupilMaterial);
    leftPupil.position.set(-0.32, 0.55, 1.08);
    const rightPupil = leftPupil.clone();
    rightPupil.position.x = 0.44;

    const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), cheekMaterial);
    leftCheek.position.set(-0.42, 0.14, 0.98);
    const rightCheek = leftCheek.clone();
    rightCheek.position.x = 0.42;

    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.03, 12, 24, Math.PI),
      mouthMaterial,
    );
    mouth.position.set(0, 0.12, 1.02);
    mouth.rotation.set(Math.PI, 0, 0);

    bodyGroup.add(
      leftEye,
      rightEye,
      leftPupil,
      rightPupil,
      leftCheek,
      rightCheek,
      mouth,
    );

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), shadowMaterial);
    shadow.position.set(0, -1.56, -0.4);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.3, 0.62, 1);
    mascot.add(shadow);

    const sparkleGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    const sparkleMaterial = new THREE.MeshBasicMaterial({
      color: "#fff3aa",
      transparent: true,
      opacity: 0.95,
    });
    const sparkles = [
      new THREE.Mesh(sparkleGeometry, sparkleMaterial),
      new THREE.Mesh(sparkleGeometry, sparkleMaterial),
      new THREE.Mesh(sparkleGeometry, sparkleMaterial),
    ];
    sparkles[0].position.set(-1.25, 1.05, 0.35);
    sparkles[1].position.set(1.1, 0.75, 0.55);
    sparkles[2].position.set(0.98, 1.55, -0.15);
    sparkles.forEach((sparkle) => mascot.add(sparkle));

    scene.add(mascot);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const activeOffset = activeRef.current ? 0.22 : 0;
      const blink = 0.18 + 0.82 * Math.abs(Math.sin(elapsed * 0.35 + 0.9));
      const blinkScale = blink > 0.24 ? 1 : 0.12;
      const bob = Math.sin(elapsed * 1.85) * 0.16;
      const squeeze = 1 + Math.sin(elapsed * 1.85 + 0.4) * 0.04;

      mascot.rotation.y = Math.sin(elapsed * 0.95) * 0.22 + activeOffset;
      mascot.rotation.z = Math.sin(elapsed * 1.2) * 0.05;
      mascot.position.y = bob;
      bodyGroup.scale.set(1 - (squeeze - 1) * 0.45, squeeze, 1 - (squeeze - 1) * 0.25);
      bodyGroup.rotation.x = Math.sin(elapsed * 1.25) * 0.03;
      bodyGroup.rotation.z = Math.sin(elapsed * 1.1 + 0.5) * 0.025;
      shadow.scale.x = 1.22 - bob * 0.32;
      shadow.scale.y = 0.62 - bob * 0.16;

      leftEye.scale.y = 1.2 * blinkScale;
      rightEye.scale.y = 1.2 * blinkScale;
      leftPupil.scale.y = blinkScale;
      rightPupil.scale.y = blinkScale;

      leftPupil.position.x = -0.33 + Math.sin(elapsed * 0.7) * 0.04;
      rightPupil.position.x = 0.43 + Math.sin(elapsed * 0.7) * 0.04;
      leftPupil.position.y = 0.55 + Math.sin(elapsed * 0.9) * 0.018;
      rightPupil.position.y = 0.55 + Math.sin(elapsed * 0.9) * 0.018;

      sparkles.forEach((sparkle, index) => {
        sparkle.position.y += Math.sin(elapsed * 2 + index) * 0.002;
        sparkle.position.x += Math.cos(elapsed * 1.4 + index * 1.2) * 0.0012;
        sparkle.scale.setScalar(0.85 + Math.sin(elapsed * 2.4 + index * 0.8) * 0.2);
      });

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      // The repo ships an untyped local shim for `three`, so narrow runtime checks here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scene.traverse((object: any) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          materials.forEach((material: any) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
