import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Network, GraduationCap, AudioWaveform } from "lucide-react";
import { Button } from "@studio/components/ui/button";
import { theHubEn, theHubPt } from "@studio/lib/thehub-i18n";
import { MeshGradient } from "@studio/components/landing/MeshGradient";
import { LanguageThemePill } from "@studio/components/nav/LanguageThemePill";
import { useAuth } from "@studio/hooks/use-auth";

export default function PresentationLanding() {
  const [lang, setLang] = useState<"en" | "pt">("en");
  const t = lang === "en" ? theHubEn : theHubPt;
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const Header = () => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-[20px] border-b border-border/60 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto px-6 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/60 border border-black/10 rounded-lg flex items-center justify-center backdrop-blur-xl">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-light tracking-[0.18em] text-foreground">VOICE.HUB</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
        </nav>

        <div className="flex items-center gap-6">
          <LanguageThemePill lang={lang} setLang={setLang} />
          {!isLoading && (
            <Button
              variant="outline"
              className="rounded-full px-6 bg-white/60 border-black/10 hover:bg-white/70"
              onClick={() => {
                 if (user) {
                   navigate("/hub-dub/studios");
                 } else {
                   navigate("/hub-dub/login");
                 }
               }}
            >
              {user ? t.auth.panel : t.auth.login}
            </Button>
          )}
        </div>
      </div>
    </header>
  );

  return (
    <div className="bg-background text-foreground font-sans overflow-x-hidden">
      <Header />
      <Slide1 t={t} />
      <Slide2 t={t} />
      <Slide3 t={t} />
      <Slide4 t={t} />
    </div>
  );
}

function Slide1({ t }: { t: any }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const blur = useTransform(scrollYProgress, [0, 0.8], ["blur(0px)", "blur(15px)"]);

  const springScale = useSpring(scale, { stiffness: 80, damping: 25 });
  const springOpacity = useSpring(opacity, { stiffness: 80, damping: 25 });

  return (
    <motion.section
      ref={ref as any}
      style={{ scale: springScale, opacity: springOpacity, filter: blur }}
      className="h-[100dvh] w-full relative flex items-center justify-center overflow-hidden sticky top-0 z-10 bg-background will-change-transform origin-center"
    >
      <div className="absolute inset-0 z-0">
        <div className="opacity-35">
          <MeshGradient />
        </div>
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-6xl md:text-9xl font-semibold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/55">
            {t.landing.hero.title}
          </h1>
          <p className="text-lg md:text-3xl text-muted-foreground font-medium max-w-3xl mx-auto mb-12 leading-relaxed tracking-tight">
            {t.landing.hero.subtitle}
          </p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <Button
              onClick={() => document.getElementById("hub-dub")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-12 h-14 text-[17px] font-medium transition-all hover:-translate-y-[1px] shadow-sm hover:shadow-md vhub-shine"
            >
              {t.landing.hero.cta} <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function Slide2({ t }: { t: any }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0.5, 1], [1, 0.85]);
  const opacity = useTransform(scrollYProgress, [0.5, 1], [1, 0]);
  const blur = useTransform(scrollYProgress, [0.5, 1], ["blur(0px)", "blur(15px)"]);

  const springScale = useSpring(scale, { stiffness: 80, damping: 25 });
  const springOpacity = useSpring(opacity, { stiffness: 80, damping: 25 });

  return (
    <motion.section
      id="hub-dub"
      ref={ref as any}
      style={{ scale: springScale, opacity: springOpacity, filter: blur }}
      className="h-[100dvh] w-full relative flex items-center justify-center overflow-hidden sticky top-0 z-20 bg-muted/40 will-change-transform origin-center"
    >
      <div className="max-w-[1400px] mx-auto w-full px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-20 h-20 bg-white/60 border border-black/10 rounded-2xl flex items-center justify-center mb-8 shadow-sm backdrop-blur-xl">
            <Network className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6">HUB DUB</h2>
          <p className="text-lg md:text-2xl text-muted-foreground font-medium mb-8 max-w-lg leading-relaxed tracking-tight">
            {t.landing.trinity.builder.desc}
          </p>
          <Link href="/studios">
            <Button variant="outline" className="rounded-full px-8 h-12 bg-white/60 border-black/10 hover:bg-white/70 vhub-hover-lift">
              Launch Studio <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        <motion.div
          layoutId="hub-dub-dashboard"
          initial={{ opacity: 0, rotateX: 20, scale: 0.8 }}
          whileInView={{ opacity: 1, rotateX: 0, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative cursor-pointer"
        >
          <Link href="/studios">
            <div
              className="relative aspect-[16/10] bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden vhub-hover-lift transition-transform duration-500"
              style={{ transform: "perspective(1000px) rotateY(-10deg)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-muted/60 to-card opacity-80" />
              <div className="p-8 grid grid-cols-3 gap-4">
                <div className="col-span-1 h-32 bg-muted/70 rounded-lg" />
                <div className="col-span-2 h-32 bg-muted/70 rounded-lg" />
                <div className="col-span-3 h-48 bg-muted/70 rounded-lg" />
              </div>
              <div className="absolute -inset-4 bg-primary/10 blur-3xl -z-10" />
            </div>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}

function Slide3({ t }: { t: any }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0.5, 1], [1, 0.85]);
  const opacity = useTransform(scrollYProgress, [0.5, 1], [1, 0]);
  const blur = useTransform(scrollYProgress, [0.5, 1], ["blur(0px)", "blur(15px)"]);

  const springScale = useSpring(scale, { stiffness: 80, damping: 25 });
  const springOpacity = useSpring(opacity, { stiffness: 80, damping: 25 });

  return (
    <motion.section
      id="hubschool"
      ref={ref as any}
      style={{ scale: springScale, opacity: springOpacity, filter: blur }}
      className="h-[100dvh] w-full relative flex items-center justify-center overflow-hidden sticky top-0 z-30 bg-background text-foreground will-change-transform origin-center"
    >
      <div className="max-w-[1400px] mx-auto w-full px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <motion.div
          className="order-2 md:order-1 relative"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <Link href="/login">
            <div className="grid grid-cols-2 gap-6 cursor-pointer group">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="aspect-square bg-white/60 border border-black/10 rounded-3xl p-6 flex flex-col justify-between transition-colors backdrop-blur-xl"
              >
                <div className="w-12 h-12 bg-foreground rounded-full flex items-center justify-center text-background">01</div>
                <span className="font-bold text-xl">VOX</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="aspect-square bg-white/60 border border-black/10 rounded-3xl p-6 flex flex-col justify-between mt-12 transition-colors backdrop-blur-xl"
              >
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-foreground">02</div>
                <span className="font-bold text-xl">ADR</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="aspect-square bg-white/60 border border-black/10 rounded-3xl p-6 flex flex-col justify-between transition-colors backdrop-blur-xl"
              >
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center text-foreground">03</div>
                <span className="font-bold text-xl">Mix</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="aspect-square bg-primary text-primary-foreground rounded-3xl p-6 flex flex-col justify-between mt-12 vhub-hover-lift transition-transform"
              >
                <GraduationCap className="w-12 h-12" />
                <span className="font-bold text-xl">Join</span>
              </motion.div>
            </div>
          </Link>
        </motion.div>

        <motion.div
          className="order-1 md:order-2"
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-20 h-20 bg-white/60 border border-black/10 rounded-2xl flex items-center justify-center mb-8 shadow-sm backdrop-blur-xl">
            <GraduationCap className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6">HUBSCHOOL</h2>
          <p className="text-lg md:text-2xl text-muted-foreground font-medium mb-8 max-w-lg leading-relaxed tracking-tight">
            {t.landing.trinity.learn.desc}
          </p>
          <Link href="/login">
            <Button className="bg-foreground hover:bg-foreground/90 text-background rounded-full px-8 h-12 vhub-hover-lift vhub-shine">
              Enter <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}

function Slide4({ t }: { t: any }) {
  const ref = useRef<HTMLElement>(null);

  return (
    <motion.section
      id="hub-align"
      ref={ref as any}
      className="h-[100dvh] w-full relative flex items-center justify-center overflow-hidden sticky top-0 z-40 bg-muted/30 text-foreground will-change-transform origin-center"
    >
      <div className="max-w-[1400px] mx-auto w-full px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-20 h-20 bg-white/60 border border-black/10 rounded-2xl flex items-center justify-center mb-8 shadow-sm backdrop-blur-xl">
            <AudioWaveform className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6">HUB ALIGN</h2>
          <p className="text-lg md:text-2xl text-muted-foreground font-medium mb-8 max-w-lg leading-relaxed tracking-tight">
            {t.landing.trinity.adr.desc}
          </p>
          <Link href="/login">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-12 font-medium vhub-hover-lift vhub-shine">
              Start <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative h-[400px] w-full vhub-card overflow-hidden cursor-pointer transition-colors"
        >
          <Link href="/login">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-32 relative">
                <motion.div
                  animate={{ x: ["0%", "100%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute top-0 bottom-0 w-[2px] bg-primary z-10 shadow-[0_0_20px_rgba(0,113,227,0.35)]"
                />
                <div className="flex items-end h-full gap-[2px] opacity-80 px-4">
                  {[...Array(60)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: "10%" }}
                      whileInView={{ height: `${Math.random() * 80 + 10}%` }}
                      transition={{ duration: 0.5, delay: i * 0.02 }}
                      className="flex-1 bg-primary/25 rounded-t-sm"
                    >
                      <div className="w-full h-full bg-primary opacity-15" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}
