import { AntDesign, Entypo, Feather } from "@expo/vector-icons";
import { useState } from "react";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

type Props = {
  visible: boolean;
  requestClose: () => void;
};

type FilterOptions = {
  isApproved: boolean;
  isRejected: boolean;
  isPending: boolean;
  isToday: boolean;
  isThisWeek: boolean;
  isThisMonth: boolean;
  date: string;
  isLowToHigh: boolean;
  isHighToLow: boolean;
};

type FilterItemProps = {
  label: string;
  value: boolean;
  onChangeValue: () => void;
};

const FilterItem = ({ label, value, onChangeValue }: FilterItemProps) => (
  <Pressable
    onPress={onChangeValue}
    className={`border-2 ${
      value
        ? "border-white bg-white flex-row justify-between items-center"
        : "border-[#535353] bg-transparent"
    } p-3 my-2`}
  >
    <Text className={value ? "text-[#1A1A1C]" : "text-[#535353]"}>{label}</Text>
    {value && <Entypo name="check" color="#535353" size={16} />}
  </Pressable>
);

export default function RedemptionRequestFilterModal({
  visible,
  requestClose,
}: Props) {
  const [openDateModal, setOpenDateModal] = useState<boolean>(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    isApproved: false,
    isRejected: false,
    isPending: false,
    isToday: false,
    isThisWeek: false,
    isThisMonth: false,
    date: "",
    isLowToHigh: false,
    isHighToLow: false,
  });

  const handleApply = () => {};

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={requestClose}
    >
      <View className="w-full h-full items-center justify-center bg-black/50">
        <View className="w-full py-6 mt-auto bg-[#1A1A1C] rounded-t-2xl shadow-lg gap-4 relative overflow-hidden">
          <View className="flex-row justify-between items-center px-4 mt-2">
            <View className="w-[20]" />
            <Text className="text-white text-2xl font-semibold">Filters</Text>
            <Feather name="x" color="#fff" size={20} onPress={requestClose} />
          </View>
          <View className="w-full h-0.5 bg-[#535353] my-2" />
          <View className="w-full px-4">
            <Text className="text-[#535353]">Status</Text>
            <FilterItem
              label="Approved Request"
              value={filterOptions.isApproved}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isApproved: !filterOptions.isApproved,
                })
              }
            />
            <FilterItem
              label="Rejected Request"
              value={filterOptions.isRejected}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isRejected: !filterOptions.isRejected,
                })
              }
            />
            <FilterItem
              label="Pending Request"
              value={filterOptions.isPending}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isPending: !filterOptions.isPending,
                })
              }
            />
            <Text className="text-[#535353] mt-6">Date</Text>
            <FilterItem
              label="Today"
              value={filterOptions.isToday}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isToday: !filterOptions.isToday,
                })
              }
            />
            <FilterItem
              label="This Week"
              value={filterOptions.isThisWeek}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isThisWeek: !filterOptions.isThisWeek,
                })
              }
            />
            <FilterItem
              label="This Month"
              value={filterOptions.isThisMonth}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isThisMonth: !filterOptions.isThisMonth,
                })
              }
            />
            <Pressable
              onPress={() => setOpenDateModal(true)}
              className="flex-row items-center border-2 border-[#535353] mt-2"
            >
              <Feather
                name="calendar"
                className="ml-2"
                size={20}
                color="#535353"
              />
              <TextInput
                className="h-12 bg-transparent text-[#535353] rounded-xl px-2 py-2 text-base"
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#535353"
                value={filterOptions.date}
                editable={false}
              />
              <AntDesign
                name="down"
                color="#535353"
                className="ml-auto mr-2"
                size={16}
              />
              <DateTimePickerModal
                isVisible={openDateModal}
                mode="date"
                onConfirm={(date) => {
                  setFilterOptions({
                    ...filterOptions,
                    date: date.toLocaleDateString("en-GB"),
                  });
                  setOpenDateModal(false);
                }}
                onCancel={() => setOpenDateModal(false)}
              />
            </Pressable>
            <Text className="text-[#535353] mt-6">RCN Amount</Text>
            <FilterItem
              label="Low to High"
              value={filterOptions.isLowToHigh}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isLowToHigh: !filterOptions.isLowToHigh,
                })
              }
            />
            <FilterItem
              label="High to Low"
              value={filterOptions.isHighToLow}
              onChangeValue={() =>
                setFilterOptions({
                  ...filterOptions,
                  isHighToLow: !filterOptions.isHighToLow,
                })
              }
            />
            <Pressable
              onPress={handleApply}
              className="bg-[#FFCC00] py-4 items-center mt-4"
            >
              <Text className="text-white text-xl font-semibold">
                Apply Filters
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setFilterOptions({
                  isApproved: false,
                  isRejected: false,
                  isPending: false,
                  isToday: false,
                  isThisWeek: false,
                  isThisMonth: false,
                  date: "",
                  isLowToHigh: false,
                  isHighToLow: false,
                })
              }
              className="mt-6 mb-4 items-center"
            >
              <Text className="text-white text-xl font-semibold">
                Clear Selections
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
