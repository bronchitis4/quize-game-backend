/**
 * Interface for individual Question
 */
export interface Question {
  /**
   * Text version of the question
   */
  text: string;

  /**
   * Points awarded for the question
   */
  points: number;

  /**
   * Content type of the question
   * - 'text': Question is plain text
   * - 'image': Question contains an image URL
   * - 'video': Question contains a video URL
   * - 'audio': Question contains an audio URL
   */
  type: 'text' | 'image' | 'video' | 'audio';

  /**
   * Question content. Can be text, image URL, or video ID/URL
   */
  content: string;

  /**
   * Optional hint for the question (e.g., for encrypted memes)
   */
  hint?: string;

  /**
   * Correct answer to the question
   */
  answer: {
    /**
     * Answer type
     * - 'text': Answer is plain text
     * - 'image': Answer contains an image URL
     * - 'video': Answer contains a video URL
     * - 'audio': Answer contains an audio URL
     */
    type: 'text' | 'image' | 'video' | 'audio';
    
    /**
     * Answer content. Can be text, image URL, or video ID/URL
     */
    content: string;
    
    /**
     * Text version of the answer
     */
    text: string;
    
    /**
     * Optional background music URL for the answer
     */
    backgroundMusic?: string;
  };
}

/**
 * Interface for Category
 */
export interface Category {
  /**
   * Category name (title)
   */
  title: string;

  /**
   * Array of questions belonging to this category
   */
  questions: Question[];
}

/**
 * Main interface for the entire game structure
 */
export interface GameData {
  /**
   * Array of all game categories
   */
  categories: Category[];
}
