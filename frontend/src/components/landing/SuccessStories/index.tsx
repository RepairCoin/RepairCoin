"use client";

import Section from "@/components/Section";
import Image from "next/image";

interface SuccessStoriesProps {
  successStoriesBgImage: string;
}

const testimonials = [
  {
    id: 1,
    name: "Luis M.",
    role: "Owner of FixIt Hub, Texas",
    avatar: "/user1.png",
    content: "Since joining RepairCoin, we’ve seen a clear spike in return customers. It’s easy to use, and our shop now stands out in a crowded market.",
  },
  {
    id: 2,
    name: "Marianne C.",
    role: "Customer, San Antonio, TX",
    avatar: "/user2.png",
    content: "I used to just go to the nearest shop, but now I actually look for RepairCoin partners. It feels like I’m getting more value every time.",
  },
  {
    id: 3,
    name: "Stephen Brekke",
    role: "FCustomer, Dallas, TX",
    avatar: "/user3.png",
    content: "I love that I’m earning something real while supporting local repair shops. This is how loyalty should work.",
  },
];

const SuccessStories: React.FC<SuccessStoriesProps> = ({
  successStoriesBgImage,
}) => {
  return (
    <div
      className="w-full h-full xl:h-screen md:py-8 px-4 bg-[#0D0D0D]"
      style={{ backgroundImage: `url(${successStoriesBgImage})` }}
    >
      <Section>
        <div className="w-full flex flex-col items-center py-8 xl:py-12">
          <div className="w-full flex flex-col items-center mb-12">
            <p className="text-2xl md:text-4xl xl:text-5xl font-bold text-white mb-6 text-center">
            Success Stories from the RepairCoin Network
            </p>
            <p className="text-[#FFCC00] text-sm md:text-sm xl:text-lg mb-10 text-center">
            Explore how shops are growing and customers are earning through RepairCoin.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full h-full max-w-6xl">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="bg-white relative border-2 rounded-lg shadow-xl pt-20 md:pt-16 pb-6 md:pb-8 px-5 sm:px-6 md:px-8 flex flex-col hover:shadow-2xl transition-shadow duration-300 min-h-[280px] sm:min-h-[300px] h-auto"
              >
                <div className="absolute -top-8 sm:-top-10 left-4 w-16 h-16 sm:w-20 sm:h-20 md:w-20 md:h-20 rounded-full overflow-hidden border-4 border-blue-100 bg-white">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-gray-600 italic flex-grow text-left w-full text-sm sm:text-base md:text-base">"{testimonial.content}"</p>
                <div className="w-full mt-4 sm:mt-6 text-left">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
                    {testimonial.name}
                  </h3>
                  <p className="text-gray-600 text-xs">{testimonial.role}</p>
                </div>
                <div className="absolute top-4 right-4 flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
};

export default SuccessStories;
