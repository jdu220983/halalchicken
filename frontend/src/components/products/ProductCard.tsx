import { ShoppingCart } from "lucide-react"
import { useAuth, useCart } from "@/lib/context"
import { useToast } from "@/lib/toast"
import { Product } from "@/lib/types"
import { t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { language, user } = useAuth()
  const { addToCart } = useCart()
  const { push: toast } = useToast()
  const [isAdding, setIsAdding] = useState(false)

  const handleAddToCart = async () => {
    setIsAdding(true)
    try {
      await addToCart(product, 1)
      toast({ message: t("addedToCart", language) || "Added to cart", type: "success" })
    } catch (error) {
      console.error("Failed to add to cart:", error)
      toast({ message: t("errorAddingToCart", language) || "Failed to add to cart", type: "error" })
    } finally {
      setIsAdding(false)
    }
  }

  const productName = language === "uz" ? product.name_uz : product.name_ru
  const isCustomer = !user || user.role === "CUSTOMER"

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image_url || "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=400&fit=crop"}
          alt={productName}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=400&fit=crop"
          }}
        />
        {!product.status && (
          <Badge variant="secondary" className="absolute top-2 right-2">
            {t("outOfStock", language)}
          </Badge>
        )}
        {product.status && (
          <Badge className="absolute top-2 right-2">
            {t("inStock", language)}
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {productName}
        </h3>
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}
      </CardContent>

      {isCustomer && (
        <CardFooter className="p-4 pt-0">
          <Button
            className="w-full"
            onClick={handleAddToCart}
            disabled={!product.status || isAdding}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {isAdding ? t("loading", language) : t("addToCart", language)}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
