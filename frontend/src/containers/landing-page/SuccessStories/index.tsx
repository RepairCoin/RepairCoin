"use client";

import Section from "@/components/Section";
import Image from "next/image";

interface SuccessStoriesProps {
  successStoriesBgImage: string;
}

const testimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "CEO, TechStart Inc.",
    avatar: "/images/avatar1.jpg",
    content: "RepairCoin transformed our repair business. The platform is intuitive and our customers love the transparency.",
  },
  {
    id: 2,
    name: "Michael Chen",
    role: "Operations Manager, FixIt Pro",
    avatar: "/images/avatar2.jpg",
    content: "The best decision we made was switching to RepairCoin. Our workflow is now 40% more efficient.",
  },
  {
    id: 3,
    name: "Emma Williams",
    role: "Founder, GadgetCare",
    avatar: "/images/avatar3.jpg",
    content: "Outstanding service and support. The team at RepairCoin truly understands the repair industry.",
  },
];

const SuccessStories: React.FC<SuccessStoriesProps> = ({
  successStoriesBgImage,
}) => {
  return (
    <div
      className="w-full min-h-screen md:py-8 px-4"
      style={{ backgroundImage: `url(${successStoriesBgImage})` }}
    >
      <Section>
        <div className="w-full flex flex-col items-center py-8 xl:py-12">
          <div className="w-full flex flex-col items-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 text-center">
              Success Stories
            </h2>
            <p className="text-white text-lg text-center max-w-2xl mb-10">
              Don't just take our word for it. Here's what our partners have to say about us.
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
                  <p className="text-blue-600 text-xs sm:text-sm">{testimonial.role}</p>
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
