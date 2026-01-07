// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ChevronLeft } from 'lucide-react';

// -- Component Imports --
import { IconButton } from '../ui/icon-button';
import MarkdownContent from '../molecules/markdown-content';

interface MobileAboutProps {
	onBack?: () => void;
}

type TabId = 'about' | 'license' | 'credits';

export default function MobileAbout({ onBack }: MobileAboutProps) {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<TabId>('about');

	const localizationContributors = '- **Deutsch:** Markus Raab';

	const tabs = [
		{ id: 'about' as TabId, label: t('InfoDialog.tabs.about') },
		{ id: 'license' as TabId, label: t('InfoDialog.tabs.license') },
		{ id: 'credits' as TabId, label: t('InfoDialog.tabs.credits') },
	];

	return (
		<div className="h-full flex flex-col overflow-y-auto">
			<div className="p-6">
				<div className="flex items-center gap-3 mb-4">
					{onBack && (
						<IconButton
							variant="ghost"
							size="lg"
							onClick={onBack}
							className="h-10 w-10 p-0"
						>
							<ChevronLeft className="h-8 w-8" />
						</IconButton>
					)}
					<div className="flex-1">
						<h2 className="text-2xl font-bold">{t('InfoDialog.title')}</h2>
					</div>
				</div>
				<p className="text-sm text-muted-foreground">
					{t('InfoDialog.description')}
				</p>
			</div>

			{/* Tab Navigation */}
			<div className="px-6 pb-4">
				<div className="flex gap-2 border-b border-border">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`px-4 py-3 text-base font-medium transition-colors relative ${
								activeTab === tab.id
									? 'text-primary'
									: 'text-muted-foreground'
							}`}
						>
							{tab.label}
							{activeTab === tab.id && (
								<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
							)}
						</button>
					))}
				</div>
			</div>

			{/* Tab Content */}
			<div className="flex-1 px-6 pb-6 overflow-y-auto">
				{activeTab === 'about' && (
					<div className="prose prose-sm max-w-none dark:prose-invert">
						<MarkdownContent content={t('InfoDialog.content.about')} />
					</div>
				)}

				{activeTab === 'license' && (
					<div className="prose prose-sm max-w-none dark:prose-invert">
						<MarkdownContent content={t('InfoDialog.content.license')} />
						<a
							rel="license"
							href="http://creativecommons.org/licenses/by-nc-sa/4.0/"
							className="inline-block my-4"
						>
							<img
								alt="Creative Commons License"
								width={88}
								height={31}
								src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png"
							/>
						</a>
						<p className="text-xs text-muted-foreground">{t('InfoDialog.license_credit')}</p>
					</div>
				)}

				{activeTab === 'credits' && (
					<div className="prose prose-sm max-w-none dark:prose-invert">
						<MarkdownContent content={t('InfoDialog.content.credits')} />

						<MarkdownContent content={t('InfoDialog.content.localization')} />
						<MarkdownContent content={localizationContributors} />

						<MarkdownContent content={t('InfoDialog.content.support')} />
						<a
							href="https://ko-fi.com/altervayne"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-block mt-4"
						>
							<img
								alt={t('InfoDialog.kofi_alt')}
								src="https://storage.ko-fi.com/cdn/brandasset/kofi_button_dark.png"
								width={214}
								height={40}
							/>
						</a>
					</div>
				)}
			</div>
		</div>
	);
}
