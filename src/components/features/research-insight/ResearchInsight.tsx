import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, 
  Newspaper, 
  Pill, 
  FileText, 
  Filter, 
  Search, 
  RefreshCw,
  TrendingUp,
  Globe,
  BookOpen,
  Sparkles,
  Clock,
  Star,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useResponsive } from '../../../hooks/useResponsive';
import { VoiceInput } from '../../ui/VoiceInput';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ResponsiveModal } from '../../ui/ResponsiveModal';
import { Pagination } from '../../ui/Pagination';
import { NewsCard } from './NewsCard';
import { DrugInventionCard } from './DrugInventionCard';
import { CaseHistoryCard } from './CaseHistoryCard';
import { ResearchFilters } from './ResearchFilters';
import { cn } from '../../../lib/utils';
import { 
  useMedicalNews, 
  useDrugInsights, 
  useCaseStudies,
  useCategories,
  useUserBookmarks,
  usePersonalizedRecommendations,
  useGenerateContent,
  useRefreshAllContent,
  useTrackContentInteraction
} from '../../../hooks/useResearchInsight';
import { isOpenAIAvailable } from '../../../lib/openai';
import type { ResearchFilters as ResearchFiltersInterface } from '../../../types/research.types';

export const ResearchInsight: React.FC = () => {
  const { isMobile } = useResponsive();
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'news' | 'drugs' | 'cases'>('news');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [selectedSignificance, setSelectedSignificance] = useState<string>('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Build filters object
  const filters: ResearchFiltersInterface = useMemo(() => ({
    categories: selectedCategories.length > 0 ? selectedCategories : profile?.department ? [profile.department] : undefined,
    searchQuery: searchQuery || undefined,
    difficulty: (selectedDifficulty as ResearchFiltersInterface['difficulty']) || undefined,
    significance: (selectedSignificance as ResearchFiltersInterface['significance']) || undefined,
    timeRange: (selectedTimeRange as ResearchFiltersInterface['timeRange']) || undefined,
    page: currentPage,
    pageSize
  }), [selectedCategories, profile?.department, searchQuery, selectedDifficulty, 
       selectedSignificance, selectedTimeRange, currentPage, pageSize]);
  
  // React Query hooks with filters
  const { data: newsData = [], isLoading: newsLoading, refetch: refetchNews } = useMedicalNews(filters);
  const { data: drugData = [], isLoading: drugLoading, refetch: refetchDrugs } = useDrugInsights(filters);
  const { data: caseData = [], isLoading: caseLoading, refetch: refetchCases } = useCaseStudies(filters);
  const { data: recommendations = [] } = usePersonalizedRecommendations();
  const { data: categories = [] } = useCategories();
  const { data: bookmarks = [] } = useUserBookmarks();
  const generateContentMutation = useGenerateContent();
  const refreshAllMutation = useRefreshAllContent();
  const trackInteractionMutation = useTrackContentInteraction();
  
  // Create a map of bookmarked content for quick lookup
  const bookmarkedContent = useMemo(() => {
    const bookmarkMap = new Map();
    bookmarks.forEach(bookmark => {
      bookmarkMap.set(`${bookmark.content_type}-${bookmark.content_id}`, true);
    });
    return bookmarkMap;
  }, [bookmarks]);
  
  // Add isBookmarked property to content items
  const enhanceWithBookmarks = useCallback((items: any[], type: string) => {
    return items.map(item => ({
      ...item,
      isBookmarked: bookmarkedContent.has(`${type}-${item.id}`)
    }));
  }, [bookmarkedContent]);

  // Enhanced data with bookmarks
  const enhancedNewsData = useMemo(() => enhanceWithBookmarks(newsData, 'news'), 
    [newsData, enhanceWithBookmarks]);
    
  const enhancedDrugData = useMemo(() => enhanceWithBookmarks(drugData, 'drug'), 
    [drugData, enhanceWithBookmarks]);
    
  const enhancedCaseData = useMemo(() => enhanceWithBookmarks(caseData, 'case'), 
    [caseData, enhanceWithBookmarks]);

  // Track when content is viewed
  useEffect(() => {
    if (activeTab === 'news' && enhancedNewsData.length > 0) {
      trackInteractionMutation.mutate({
        contentType: 'news',
        contentId: enhancedNewsData[0].id,
        interactionType: 'view'
      });
    } else if (activeTab === 'drugs' && enhancedDrugData.length > 0) {
      trackInteractionMutation.mutate({
        contentType: 'drug',
        contentId: enhancedDrugData[0].id,
        interactionType: 'view'
      });
    } else if (activeTab === 'cases' && enhancedCaseData.length > 0) {
      trackInteractionMutation.mutate({
        contentType: 'case',
        contentId: enhancedCaseData[0].id,
        interactionType: 'view'
      });
    }
  }, [activeTab, enhancedNewsData, enhancedDrugData, enhancedCaseData, trackInteractionMutation]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategories, selectedDifficulty, selectedSignificance, selectedTimeRange]);

  const handleRefresh = () => {
    setIsLoading(true);
    refreshAllMutation.mutate();
  };

  const handleGenerateContent = (type: 'news' | 'drugs' | 'cases') => {
    setIsLoading(true);
    generateContentMutation.mutate({
      type,
      params: { specialty: profile?.department }
    });
  };

  // Update loading state
  useEffect(() => {
    setIsLoading(newsLoading || drugLoading || caseLoading || 
                refreshAllMutation.isPending || generateContentMutation.isPending);
  }, [newsLoading, drugLoading, caseLoading, refreshAllMutation.isPending, generateContentMutation.isPending]);

  const tabs = [
    {
      id: 'news' as const,
      label: 'Healthcare News',
      icon: Newspaper,
      count: enhancedNewsData.length,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'drugs' as const,
      label: 'Drug Inventions',
      icon: Pill,
      count: enhancedDrugData.length,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'cases' as const,
      label: 'Case Histories',
      icon: FileText,
      count: enhancedCaseData.length,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Accessibility Improvements */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" 
        role="banner"
      >
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center" id="page-title">
            <FlaskConical className="w-6 h-6 mr-2 text-primary-600" />
            Research Insight
          </h1>
          <p className="text-neutral-600 mt-1">Stay updated with latest medical research and innovations</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(true)}
            className="hidden sm:flex" 
            aria-label="Show filters"
            aria-expanded={showFilters}
          >
            <Filter size={16} className="mr-2" />
            Filter
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading} 
            aria-label="Refresh content"
          >
            <RefreshCw size={16} className={cn("mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} 
        className="grid grid-cols-1 sm:grid-cols-3 gap-4" 
        role="region" 
        aria-label="Research statistics"
      >
        <Card padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Latest News</p>
              <p className="text-2xl font-bold text-blue-600">{enhancedNewsData.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Newspaper className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">New Drugs</p>
              <p className="text-2xl font-bold text-green-600">{enhancedDrugData.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Pill className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Case Studies</p>
              <p className="text-2xl font-bold text-purple-600">{enhancedCaseData.length}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI Status Banner */}
      {isOpenAIAvailable() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.15 }} 
          role="status"
        >
          <Card padding="md" className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900">AI-Powered Research Insights</p>
                  <p className="text-xs text-purple-700">Content curated specifically for {profile?.department}</p>
                </div>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateContent(activeTab)}
                  disabled={generateContentMutation.isPending}
                  className="border-purple-300 text-purple-700 hover:bg-purple-100"
                  aria-label="Generate new content with AI"
                >
                  <Sparkles size={14} className="mr-1" />
                  {generateContentMutation.isPending ? 'Generating...' : 'Generate New'}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Personalized Recommendations */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }} 
          role="region" 
          aria-label="Personalized recommendations"
        >
          <Card padding="lg" className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Personalized for You</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recommendations.slice(0, 4).map((rec, index) => (
                <div key={index} className="flex items-center text-sm text-blue-800">
                  <div className="w-1 h-1 bg-blue-600 rounded-full mr-2" />
                  {rec}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.2 }} 
        role="search"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <VoiceInput
            placeholder="Search research insights, drug names, or case studies..."
            value={searchQuery}
            onValueChange={(value) => setSearchQuery(value)}
            className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            aria-label="Search research content"
          />
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }} 
        role="tablist" 
        aria-label="Research content types"
      >
        <div className={cn(
          "grid gap-3",
          isMobile ? "grid-cols-1" : "grid-cols-3"
        )}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                className={cn(
                  "flex items-center p-4 rounded-lg font-medium text-sm transition-all border-2",
                  isActive
                    ? `${tab.bgColor} ${tab.color} ${tab.borderColor}`
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon size={20} className="mr-3" />
                <div className="flex-1 text-left">
                  <span className="block">{tab.label}</span>
                  <span className="text-xs opacity-75">{tab.count} items</span>
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-current rounded-full" />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }} 
        role="region" 
        aria-live="polite"
      >
        <AnimatePresence mode="wait">
          {activeTab === 'news' && (
            newsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <div className="h-32 bg-neutral-200 rounded-lg" aria-hidden="true"></div>
                  </div>
                ))}
              </div>
            ) : (
            <motion.div
              key="news"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }} 
              className="space-y-4" 
              role="tabpanel" 
              aria-labelledby="news-tab" 
              id="news-panel"
            >
              {enhancedNewsData.length === 0 ? (
                <Card padding="xl" className="text-center">
                  <Newspaper className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">No news found</h3>
                  <p className="text-neutral-600">Try adjusting your search terms or filters.</p>
                </Card>
              ) : (
                enhancedNewsData.map((news, index) => (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <NewsCard news={news} />
                  </motion.div>
                ))
              )}
              
              {/* Pagination */}
              {enhancedNewsData.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(enhancedNewsData.length / pageSize)}
                  onPageChange={setCurrentPage}
                />
              )}
            </motion.div>
            )
          )}

          {activeTab === 'drugs' && (
            drugLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <div className="h-32 bg-neutral-200 rounded-lg" aria-hidden="true"></div>
                  </div>
                ))}
              </div>
            ) : (
            <motion.div
              key="drugs"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }} 
              className="space-y-4" 
              role="tabpanel" 
              aria-labelledby="drugs-tab" 
              id="drugs-panel"
            >
              {enhancedDrugData.length === 0 ? (
                <Card padding="xl" className="text-center">
                  <Pill className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">No drug inventions found</h3>
                  <p className="text-neutral-600">Try adjusting your search terms or filters.</p>
                </Card>
              ) : (
                enhancedDrugData.map((drug, index) => (
                  <motion.div
                    key={drug.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <DrugInventionCard drug={drug} />
                  </motion.div>
                ))
              )}
              
              {/* Pagination */}
              {enhancedDrugData.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(enhancedDrugData.length / pageSize)}
                  onPageChange={setCurrentPage}
                />
              )}
            </motion.div>
            )
          )}

          {activeTab === 'cases' && (
            caseLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <div className="h-32 bg-neutral-200 rounded-lg" aria-hidden="true"></div>
                  </div>
                ))}
              </div>
            ) : (
            <motion.div
              key="cases"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }} 
              className="space-y-4" 
              role="tabpanel" 
              aria-labelledby="cases-tab" 
              id="cases-panel"
            >
              {enhancedCaseData.length === 0 ? (
                <Card padding="xl" className="text-center">
                  <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">No case histories found</h3>
                  <p className="text-neutral-600">Try adjusting your search terms or filters.</p>
                </Card>
              ) : (
                enhancedCaseData.map((caseHistory, index) => (
                  <motion.div
                    key={caseHistory.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <CaseHistoryCard caseHistory={caseHistory} />
                  </motion.div>
                ))
              )}
              
              {/* Pagination */}
              {enhancedCaseData.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(enhancedCaseData.length / pageSize)}
                  onPageChange={setCurrentPage}
                />
              )}
            </motion.div>
            )
          )}
        </AnimatePresence>
      </motion.div>

      {/* Filters Modal */}
      <ResponsiveModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)} 
        title="Filter Research Insights"
        size="md" 
        aria-labelledby="filter-dialog-title"
      >
        <ResearchFilters
          categories={categories.map(c => c.name)}
          selectedCategories={selectedCategories} 
          onCategoriesChange={setSelectedCategories} 
          selectedDifficulty={selectedDifficulty}
          onDifficultyChange={setSelectedDifficulty}
          selectedSignificance={selectedSignificance}
          onSignificanceChange={setSelectedSignificance}
          selectedTimeRange={selectedTimeRange}
          onTimeRangeChange={setSelectedTimeRange}
          onClose={() => setShowFilters(false)}
        />
      </ResponsiveModal>
    </div>
  );
};