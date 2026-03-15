import { motion, useScroll, useTransform } from "framer-motion";
import { Link, useLocation, useSearch } from "wouter";
import { useEffect, useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { en, pt } from "@/lib/i18n";
import { HeroSearch } from "@/components/hubschool/HeroSearch";
import { CategoryFilters } from "@/components/hubschool/CategoryFilters";
import { CourseGrid } from "@/components/hubschool/CourseGrid";
import { PopularCourses } from "@/components/hubschool/PopularCourses";
import coursesData from "@/data/hubschool-courses.json";
import { Course, Category } from "@/types/hubschool";
import { AppHeader } from "@/components/nav/AppHeader";

export default function HubSchool() {
  const [lang, setLang] = useState<"en" | "pt">("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const search = useSearch();
  const [, navigate] = useLocation();
  
  const t = lang === "en" ? en : pt;

  const filteredCourses = useMemo(() => {
    return (coursesData as Course[]).filter((course) => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            course.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? course.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const scrollToCourses = () => {
    const element = document.getElementById("courses-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(search || "");
    if (params.get("scroll") === "courses") {
      setTimeout(() => {
        const element = document.getElementById("courses-section");
        element?.scrollIntoView({ behavior: "smooth" });
        navigate("/hubschool", { replace: true });
      }, 50);
    }
  }, [navigate, search]);

  const heroRef = useRef<HTMLElement>(null);
  const coursesRef = useRef<HTMLElement>(null);

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.85]);
  const heroBlur = useTransform(heroProgress, [0, 0.8], [0, 15]);
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <AppHeader lang={lang} setLang={setLang} />

      <main className="pt-[60px] relative">
        {/* Hero Section */}
        <section ref={heroRef} className="h-[120dvh] relative">
          <motion.div 
            style={{ scale: heroScale, opacity: heroOpacity, filter: `blur(${heroBlur}px)` as any }}
            className="sticky top-[60px] h-[100dvh] flex flex-col items-center justify-center text-center px-6 will-change-transform"
          >
            <motion.div 
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl mx-auto z-10 relative w-full"
            >
              <div className="mb-6 flex justify-center">
                <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Voltar para THE HUB
                </Link>
              </div>
              <h2 className="text-sm md:text-base font-semibold text-primary mb-4 tracking-[0.26em] uppercase">{t.hubschool.hero.subtitle}</h2>
              <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground mb-6 leading-[1.05]">{t.hubschool.hero.title}</h1>
              <p className="text-lg md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto mb-10 leading-relaxed tracking-tight">
                {t.hubschool.hero.desc}
              </p>
              
              <div className="mb-8">
                 <Button 
                    onClick={scrollToCourses}
                    className="bg-foreground hover:bg-foreground/90 text-background rounded-full px-10 h-14 text-[17px] font-medium shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all"
                 >
                    {t.hubschool.hero.cta}
                 </Button>
              </div>

              <div className="mt-12">
                 <HeroSearch query={searchQuery} onSearch={setSearchQuery} />
              </div>
              
              <div className="mt-8 flex justify-center">
                 <CategoryFilters selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
              </div>

            </motion.div>
          </motion.div>
        </section>

        {/* Content Section */}
        <section id="courses-section" ref={coursesRef} className="relative z-20 py-24 px-6 bg-[#f5f5f7] border-t border-border/10">
           <div className="max-w-[1400px] mx-auto space-y-20">
              
              {/* Popular Courses */}
              {!searchQuery && !selectedCategory && (
                 <PopularCourses courses={coursesData as Course[]} />
              )}

              {/* All Courses Grid */}
              <motion.div 
                className="space-y-6"
                initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                 <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">
                       {searchQuery ? `Search Results for "${searchQuery}"` : 
                        selectedCategory ? `${selectedCategory} Courses` : "All Courses"}
                    </h2>
                    <span className="text-muted-foreground text-sm font-medium">
                       {filteredCourses.length} courses available
                    </span>
                 </div>
                 
                 <CourseGrid courses={filteredCourses} />
                 
                 {filteredCourses.length === 0 && (
                    <div className="text-center py-20">
                       <p className="text-xl text-gray-500">No courses found matching your criteria.</p>
                       <Button 
                          variant="ghost" 
                          onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
                          className="mt-4 text-primary"
                       >
                          Clear filters
                       </Button>
                    </div>
                 )}
              </motion.div>

           </div>
        </section>
      </main>
    </div>
  );
}
