import { View, ScrollView } from "react-native";
import { useWriteReview } from "../hooks";
import {
  ReviewHeader,
  ServiceInfoCard,
  StarRating,
  CommentInput,
  ImagePicker,
  ReviewTips,
  SubmitButton,
} from "../components";

export default function WriteReviewScreen() {
  const {
    serviceName,
    shopName,
    rating,
    comment,
    setComment,
    images,
    setImages,
    isSubmitted,
    handleRatingSelect,
    handleSubmit,
    handleGoBack,
    getRatingText,
    isSubmitDisabled,
    isPending,
  } = useWriteReview();

  return (
    <View className="flex-1 bg-zinc-950">
      <ReviewHeader onBack={handleGoBack} />

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <ServiceInfoCard serviceName={serviceName} shopName={shopName} />

        <StarRating
          rating={rating}
          ratingText={getRatingText()}
          onSelectRating={handleRatingSelect}
        />

        <CommentInput value={comment} onChangeText={setComment} />

        <ImagePicker images={images} onImagesChange={setImages} maxImages={5} />

        <ReviewTips />

        <View className="h-24" />
      </ScrollView>

      <SubmitButton
        onSubmit={handleSubmit}
        isDisabled={isSubmitDisabled}
        isPending={isPending}
        isSubmitted={isSubmitted}
        hasRating={rating > 0}
      />
    </View>
  );
}
