interface CommunityBannerProps {
  communityBannerBgImage: string;
  bannerChainImage: string;
}

export default function CommunityBanner({ communityBannerBgImage, bannerChainImage }: CommunityBannerProps) {
  return (
    <section 
      className="py-20 bg-green-600 text-white relative overflow-hidden"
      style={{ backgroundImage: `url(${communityBannerBgImage})` }}
    >
      <div 
        className="absolute inset-0 opacity-10"
        style={{ backgroundImage: `url(${bannerChainImage})` }}
      />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold mb-6">Join the Repair Revolution</h2>
          <p className="text-xl mb-8 text-green-100">
            Be part of a sustainable future where every repair matters. Connect your wallet, 
            find participating shops, and start earning RepairCoin tokens today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button className="bg-white text-green-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Connect Wallet
            </button>
            <button className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-green-600 transition-colors">
              Find Shops Near You
            </button>
          </div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-green-200">500+</div>
              <div className="text-green-100">Participating Shops</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-200">10K+</div>
              <div className="text-green-100">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-200">1M+</div>
              <div className="text-green-100">Tokens Earned</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}