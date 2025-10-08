import MapView, { Marker } from "react-native-maps";
import { View } from "react-native";

type Shop = {
  id: string;
  name: string;
  address: string;
  distance: string;
  lat: number;
  lng: number;
  rating: number;
};

const dummyShops: Shop[] = [
  {
    id: "SHOP001",
    name: "Quick Fix Auto Repair",
    address: "123 Main Street, New York, NY 10001",
    distance: "0.5 mi",
    lat: 40.7505,
    lng: -73.9965,
    rating: 4.8,
  },
  {
    id: "SHOP002",
    name: "Elite Car Care Center",
    address: "456 Broadway Avenue, New York, NY 10003",
    distance: "1.2 mi",
    lat: 40.724,
    lng: -73.9973,
    rating: 4.6,
  },
  {
    id: "SHOP003",
    name: "Precision Auto Works",
    address: "789 Park Plaza, New York, NY 10016",
    distance: "2.0 mi",
    lat: 40.7465,
    lng: -73.978,
    rating: 4.9,
  },
  {
    id: "SHOP004",
    name: "Downtown Motor Service",
    address: "321 Liberty Street, New York, NY 10006",
    distance: "2.5 mi",
    lat: 40.709,
    lng: -74.0132,
    rating: 4.7,
  },
];

export default function FindShop() {
  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 40.73061,
          longitude: -73.935242,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {dummyShops.map((shop) => (
          <Marker
            key={shop.id}
            coordinate={{ latitude: shop.lat, longitude: shop.lng }}
            title={shop.name}
          />
        ))}
      </MapView>
    </View>
  );
}
