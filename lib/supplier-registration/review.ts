import type { MapCoordinate } from "@/lib/maps/leaflet-demo";

export interface SupplierRegistrationReviewForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  address: string;
}

export interface SupplierRegistrationReview {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  address: string;
  coordinate: MapCoordinate;
  photo: {
    name: string;
    size: number;
    type: string;
  };
}

export function buildSupplierRegistrationReview({
  form,
  coordinate,
  photo,
}: {
  form: SupplierRegistrationReviewForm;
  coordinate: MapCoordinate;
  photo: Pick<File, "name" | "size" | "type">;
}): SupplierRegistrationReview {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    businessName: form.businessName.trim(),
    address: form.address.trim(),
    coordinate: { lat: coordinate.lat, lng: coordinate.lng },
    photo: {
      name: photo.name,
      size: photo.size,
      type: photo.type,
    },
  };
}
