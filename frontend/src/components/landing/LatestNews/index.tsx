'use client';
import Section from "@/components/Section";

interface NewsCardProps {
    imageSrc: string;
    imageAlt: string;
    title: string;
    description: string;
    date: string;
}

const NewsCard: React.FC<NewsCardProps> = ({
    imageSrc,
    imageAlt,
    title,
    description,
    date
}) => (
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
        <div className="relative w-full bg-gray-800 overflow-hidden">
            <div className="w-full pt-[56.25%] relative">
                <img 
                    src={imageSrc}
                    alt={imageAlt}
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    loading="lazy"
                />
            </div>
        </div>
        <div className="flex flex-col flex-grow p-5 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-3 line-clamp-2">{title}</h3>
            <p className="text-gray-300 text-sm sm:text-base mb-4 line-clamp-3">{description}</p>
            <div className="mt-auto pt-3 sm:pt-4">
                <p className="text-gray-400 text-xs sm:text-sm">{date}</p>
            </div>
        </div>
    </div>
);

interface LatestNewsProps {
    latestNewsBgImage: string;
}

const LatestNews: React.FC<LatestNewsProps> = ({ latestNewsBgImage }) => {
    return (
        <div
            className="w-full h-full xl:h-screen px-4 bg-[#0D0D0D]"
            style={{ backgroundImage: `url(${latestNewsBgImage})` }}
        >
            <Section>
                <div className="w-full flex flex-col items-center py-6 md:py-8 lg:py-12 px-4 md:px-6">
                    <div className="w-full flex flex-col items-center mb-8 md:mb-12 px-2 md:px-0">
                        <h1 className="text-2xl md:text-4xl xl:text-5xl font-bold text-white mb-4 md:mb-6 text-center leading-tight">
                            Insights, News & Tips From the World of Tech Repairs and Loyalty
                        </h1>
                        <p className="text-[#FFCC00] text-sm md:text-sm xl:text-lg text-center max-w-2xl mb-6 md:mb-10 px-2">
                            Discover the latest updates, partner stories, repair trends, and how crypto rewards are reshaping customer loyalty.
                        </p>
                    </div>
                    <div className="w-full max-w-7xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            <NewsCard 
                                imageSrc="/img/bitcoin.png"
                                imageAlt="Bitcoin"
                                title="RepairCoin Ecosystem Update"
                                description="Latest developments and updates in the RepairCoin ecosystem and community initiatives."
                                date="July 15, 2025"
                            />
                            <NewsCard 
                                imageSrc="/img/shop.png"
                                imageAlt="Shop"
                                title="Partnership Announcement"
                                description="Exciting new partnership with leading tech companies to expand RepairCoin's reach."
                                date="July 5, 2025"
                            />
                            <NewsCard 
                                imageSrc="/img/phone.png"
                                imageAlt="Phone"
                                title="Community Event Recap"
                                description="Highlights from our recent community meetup and future roadmap discussion."
                                date="June 28, 2025"
                            />
                        </div>
                        <div className="w-full flex justify-end mt-6 md:mt-8">
                            <button 
                                className="text-[#FFCC00] hover:text-yellow-400 px-4 md:px-6 py-2 md:py-2.5 cursor-pointer transition-colors duration-200 flex items-center text-sm md:text-base"
                                aria-label="See more news articles"
                            >
                                See more <span className='ml-1 md:ml-2 text-sm md:text-base transition-transform duration-200 group-hover:translate-x-1'>→</span>
                            </button>
                        </div>
                    </div>
                </div >
            </Section >
        </div >
    );
};

export default LatestNews;