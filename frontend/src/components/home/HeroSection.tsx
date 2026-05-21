import { Link } from "react-router-dom"
import { ChefHat, ArrowRight } from "lucide-react"
import { useAuth } from "@/lib/context"
import { t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { getAdminWhatsAppPhone } from "@/lib/whatsapp"

export function HeroSection() {
  const { language } = useAuth()
  const phoneNumber = getAdminWhatsAppPhone() || "998916170642"
  const message = "Здравствуйте! Я хочу сделать заказ"
  const encodedMessage = encodeURIComponent(message)

  return (
    <section className="relative w-full py-20 md:py-32 overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
              <ChefHat className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{t("halalCertified", language)}</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              {t("orderFresh", language)}
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-lg">
              {t("halalChickenDesc", language)}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/products">
                <Button size="lg" className="w-full sm:w-auto group">
                  {t("browseProducts", language)}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              
              <a
                href={`https://wa.me/${phoneNumber}?text=${encodedMessage}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {t("contactWhatsApp", language)}
                </Button>
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t">
              <div>
                <p className="text-3xl font-bold text-primary">500+</p>
                <p className="text-sm text-muted-foreground">{t("totalCustomers", language)}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">50+</p>
                <p className="text-sm text-muted-foreground">{t("totalProducts", language)}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">100%</p>
                <p className="text-sm text-muted-foreground">{t("halalCertified", language)}</p>
              </div>
            </div>
          </div>

          {/* Right Image */}
          <div className="relative hidden lg:block">
            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent" />
              <img
                src="https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&h=800&fit=crop"
                alt="Halal Chicken Products"
                className="object-cover w-full h-full"
              />
            </div>
            
            {/* Floating Card */}
            <div className="absolute -bottom-6 -left-6 bg-background border rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <ChefHat className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{t("trustedPartners", language)}</p>
                  <p className="text-sm text-muted-foreground">2,000+ {t("todayOrders", language)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
    </section>
  )
}
