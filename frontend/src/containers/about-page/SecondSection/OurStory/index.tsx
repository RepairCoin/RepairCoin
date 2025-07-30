const OurStory: React.FC<any> = () => {
  return (
    <div className="w-full flex gap-14 justify-between items-center py-8 xl:py-20">
      {/* Left Content */}
      <div className="w-full lg:w-1/3 space-y-6">
        <div>
          <h2 className="text-5xl font-bold text-white mb-2">Our Story</h2>
          <p className="text-[#FFCC00] text-lg">
            Repairing Devices. Rewarding Loyalty.
          </p>
        </div>

        <div className="space-y-4 text-gray-300">
          <p>
            As a repair shop owner, I noticed something missing— customers were
            happy with the fix, but there was no lasting connection. I wanted to
            change that.
          </p>

          <p>
            So I created{" "}
            <span className="text-[#FFCC00] font-semibold">RepairCoin</span>
            —a way to reward every repair and build loyalty through real value.
            Now, every device fixed earns crypto, turning everyday repairs into
            something bigger: a movement that supports both customers and local
            shops.
          </p>
        </div>
      </div>

      {/* Right Content - Images with Flexbox */}
      <div className="w-full lg:w-2/3 flex gap-4">
        <div className="rounded-2xl overflow-hidden flex-1">
          <img
            src="/story1.png"
            alt="Repair shop owner working"
            className="w-full h-48 object-cover"
          />
        </div>
        <div className="rounded-2xl overflow-hidden flex-1">
          <img
            src="/story2.png"
            alt="Shop owner with tools"
            className="w-full h-48 object-cover"
          />
        </div>
        <div className="rounded-2xl overflow-hidden flex-1">
          <img
            src="/story3.png"
            alt="Repair shop interior"
            className="w-full h-48 object-cover"
          />
        </div>
      </div>
    </div>
  );
};

export default OurStory;
