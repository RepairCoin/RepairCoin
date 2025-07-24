interface LatestNewsProps {
  latestNewsBgImage: string;
}

export default function LatestNews({ latestNewsBgImage }: LatestNewsProps) {
  const news = [
    {
      date: "July 20, 2025",
      title: "RepairCoin Network Expands to 500+ Shops",
      excerpt: "Our growing network now includes over 500 certified repair shops across major cities.",
      category: "Network"
    },
    {
      date: "July 15, 2025",
      title: "New Tier Bonus System Launched",
      excerpt: "Bronze, Silver, and Gold shops now offer enhanced token bonuses for repairs.",
      category: "Features"
    },
    {
      date: "July 10, 2025",
      title: "Cross-Shop Redemption Goes Live",
      excerpt: "Customers can now redeem tokens at any participating shop in the network.",
      category: "Update"
    }
  ];

  return (
    <section className="py-16 bg-white" style={{ backgroundImage: `url(${latestNewsBgImage})` }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Latest News</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Stay updated with the latest developments in the RepairCoin ecosystem.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {news.map((article, index) => (
            <article key={index} className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">{article.date}</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    {article.category}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{article.title}</h3>
                <p className="text-gray-600 mb-4">{article.excerpt}</p>
                <button className="text-green-600 hover:text-green-700 font-medium">
                  Read more →
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}