import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const runtimeErrors = new WeakMap<Page,string[]>()
test.beforeEach(({page}) => {
  const errors:string[]=[]
  runtimeErrors.set(page,errors)
  page.on('pageerror',(error)=>errors.push(error.message))
})
test.afterEach(({page})=>expect(runtimeErrors.get(page)).toEqual([]))

async function demo(page:Page,query='') {
  await page.goto('/login'+query)
  await page.getByRole('button',{name:'Try mock demo account'}).click()
  await page.getByRole('link',{name:'Continue to Dashboard'}).click()
  await expect(page.getByRole('region',{name:'Selected career overview'})).toBeVisible()
}
async function navigate(page:Page,name:string) {
  if(await page.getByRole('button',{name:'Open navigation'}).isVisible()){
    await page.getByRole('button',{name:'Open navigation'}).click()
    const link=page.getByRole('dialog').getByRole('link',{name,exact:true})
    const path=await link.getAttribute('href')
    await link.click()
    await expect(page).toHaveURL(path!)
  } else {
    const link=page.getByRole('navigation').getByRole('link',{name,exact:true})
    const path=await link.getAttribute('href')
    await link.click()
    await expect(page).toHaveURL(path!)
  }
}
function overview(page:Page){return page.getByRole('region',{name:'Selected career overview'})}

test('anonymous users can explore paths without saving personal choices',async({page})=>{
  await page.goto('/')
  const cards=page.getByRole('region',{name:'Available career paths'})
  await cards.getByRole('article').filter({has:page.getByRole('heading',{name:'Data Analyst',exact:true})}).getByRole('link',{name:'Explore path'}).click()
  await expect(page.getByRole('heading',{name:'Pandas',exact:true})).toBeVisible()
  await expect(page.getByText(/Sample demo progress/)).toBeVisible()
  await expect(page.getByRole('button',{name:'Choose Data Analyst',exact:true})).toHaveCount(0)
  await navigate(page,'Dashboard')
  await expect(overview(page)).toHaveCount(0)
})

test('new account starts with no selection, saves paths across routes and can clear them',async({page})=>{
  await page.goto('/signup')
  await page.getByLabel('Name',{exact:true}).fill('Career Student')
  await page.getByLabel('Email',{exact:true}).fill('career@example.test')
  await page.getByLabel('Password',{exact:true}).fill('CareerTest123!')
  await page.getByLabel('Confirm password',{exact:true}).fill('CareerTest123!')
  await page.getByRole('button',{name:'Create mock account'}).click()
  await page.getByRole('link',{name:'Continue to Dashboard'}).click()
  await expect(page.getByRole('heading',{name:'Choose your first career path'})).toBeVisible()
  await page.getByRole('button',{name:'Choose Backend Developer',exact:true}).click()
  await expect(overview(page)).toContainText('Backend Developer')
  await expect(overview(page)).toContainText('0 of 4 unique skills completed')
  await navigate(page,'Career Paths')
  await expect(page.getByRole('button',{name:'Choose Backend Developer',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:'Choose Data Analyst',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Career selection saved')
  await navigate(page,'Dashboard')
  await expect(overview(page)).toContainText('Data Analyst')
  await page.getByRole('button',{name:'Clear selected paths'}).click()
  await expect(page.getByRole('heading',{name:'Choose your first career path'})).toBeVisible()
  await expect(overview(page)).toHaveCount(0)
})

test('all three paths update accurate dashboard widgets and service recommendation reasons',async({page})=>{
  await demo(page)
  await expect(overview(page)).toContainText('1 of 4 unique skills completed')
  await expect(page.locator('dl').getByText('0',{exact:true})).toBeVisible()
  const recommendations=page.getByRole('region',{name:'Recommended next skills'})
  await expect(recommendations).toContainText('Continue learning CSS; prerequisites completed or verified: HTML.')
  await expect(page.getByRole('region',{name:'Your skill gaps'})).toContainText('React')
  for(const name of ['Backend Developer','Data Analyst','Frontend Developer']){
    await page.getByRole('button',{name:`Choose ${name}`,exact:true}).click()
    await expect(page.getByRole('status')).toContainText('Career selection saved')
    await expect(overview(page)).toContainText(name)
    await expect(overview(page)).toContainText(name==='Frontend Developer'?'1 of 4 unique skills completed':'0 of 4 unique skills completed')
  }
})

test('multiple paths count Python and SQL once and combine recommendation explanations',async({page})=>{
  await demo(page)
  await page.getByRole('button',{name:'Choose Backend Developer',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Career selection saved')
  await page.getByRole('checkbox',{name:'Include Data Analyst',exact:true}).check()
  await expect(overview(page)).toContainText('Backend Developer + Data Analyst')
  await expect(overview(page)).toContainText('0 of 6 unique skills completed')
  const recommendations=page.getByRole('region',{name:'Recommended next skills'})
  await expect(recommendations.getByRole('heading',{name:'Python',exact:true})).toHaveCount(1)
  await expect(recommendations.getByRole('listitem').filter({has:page.getByRole('heading',{name:'Python',exact:true})})).toContainText('Data Analyst: Continue learning Python; no prerequisites.')
  await expect(page.getByRole('region',{name:'Your skill gaps'}).getByText('SQL',{exact:true})).toHaveCount(1)
})

test('rapid switching serializes delayed writes and the latest intent survives navigation',async({page})=>{
  await demo(page,'?mockLatencyMs=180')
  await page.getByRole('button',{name:'Choose Frontend Developer',exact:true}).click()
  await page.getByRole('button',{name:'Choose Backend Developer',exact:true}).click()
  await page.getByRole('button',{name:'Choose Data Analyst',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Saving your career selection')
  await expect(page.getByRole('status')).toContainText('Career selection saved')
  await expect(overview(page)).toContainText('Data Analyst')
  await navigate(page,'Career Paths')
  await expect(page.getByRole('button',{name:'Choose Data Analyst',exact:true})).toHaveAttribute('aria-pressed','true')
  await navigate(page,'Dashboard')
  await expect(overview(page)).toContainText('Data Analyst')
  await expect(overview(page)).not.toContainText('Frontend Developer')
})

test('failed selection keeps confirmed totals and retries successfully',async({page})=>{
  await demo(page)
  await page.evaluate(async()=>{
    const modulePath='/src/services/index.ts'
    const {service}=await import(modulePath)
    const original=service.setSelectedCareers.bind(service)
    let failed=false
    service.setSelectedCareers=async(ids:string[])=>{if(!failed){failed=true;throw new Error('Simulated write failure')}return original(ids)}
  })
  await page.getByRole('button',{name:'Choose Backend Developer',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Could not save or refresh')
  await expect(overview(page)).toContainText('Frontend Developer')
  await page.getByRole('button',{name:'Retry selection'}).click()
  await expect(overview(page)).toContainText('Backend Developer')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('dashboard read failures show retry instead of fabricated zero totals',async({page})=>{
  await page.goto('/login')
  await page.evaluate(async()=>{
    const modulePath='/src/services/index.ts'
    const {service}=await import(modulePath)
    const original=service.getAnalytics.bind(service)
    service.getAnalytics=Object.assign(async()=>{throw new Error('Simulated read failure')},{original})
  })
  await page.getByRole('button',{name:'Try mock demo account'}).click()
  await page.getByRole('link',{name:'Continue to Dashboard'}).click()
  await expect(page.getByRole('alert')).toContainText('Failed to load career paths')
  await expect(overview(page)).toHaveCount(0)
  await page.evaluate(async()=>{
    const modulePath='/src/services/index.ts'
    const {service}=await import(modulePath)
    service.getAnalytics=service.getAnalytics.original
  })
  await page.getByRole('button',{name:'Retry loading'}).click()
  await expect(overview(page)).toContainText('1 of 4 unique skills completed')
})

test('keyboard selection works without horizontal overflow at mobile, tablet and desktop widths',async({page})=>{
  await demo(page)
  for(const width of [320,375,768,1280]){
    await page.setViewportSize({width,height:900})
    const choose=page.getByRole('button',{name:'Choose Backend Developer',exact:true})
    await page.keyboard.press('Tab')
    await choose.focus()
    await expect(choose).toHaveCSS('outline-style','solid')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('Career selection saved')
    const extra=page.getByRole('checkbox',{name:'Include Data Analyst',exact:true})
    await extra.focus()
    await page.keyboard.press('Space')
    await expect(overview(page)).toContainText('Backend Developer + Data Analyst')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await navigate(page,'Career Paths')
    await expect(page.getByRole('progressbar',{name:'Career progress',exact:true})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await navigate(page,'Dashboard')
  }
})

test('logout and another account do not inherit selected paths',async({page})=>{
  await demo(page)
  await page.getByRole('button',{name:'Choose Data Analyst',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Career selection saved')
  await page.getByRole('button',{name:'Log out',exact:true}).click()
  await page.getByRole('link',{name:'Sign up',exact:true}).first().click()
  await page.getByLabel('Name',{exact:true}).fill('Separate Student')
  await page.getByLabel('Email',{exact:true}).fill('separate@example.test')
  await page.getByLabel('Password',{exact:true}).fill('CareerTest123!')
  await page.getByLabel('Confirm password',{exact:true}).fill('CareerTest123!')
  await page.getByRole('button',{name:'Create mock account'}).click()
  await page.getByRole('link',{name:'Continue to Dashboard'}).click()
  await expect(page.getByRole('heading',{name:'Choose your first career path'})).toBeVisible()
  await expect(overview(page)).toHaveCount(0)
})


test('failed refresh after a successful write warns and retry reconciles confirmed data',async({page})=>{
  await demo(page)
  await page.evaluate(async()=>{
    const modulePath='/src/services/index.ts'
    const {service}=await import(modulePath)
    const original=service.getRecommendations.bind(service)
    let failed=false
    service.getRecommendations=async(id:string)=>{if(!failed){failed=true;throw new Error('Simulated refresh failure')}return original(id)}
  })
  await page.getByRole('button',{name:'Choose Backend Developer',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('your change may have been saved')
  await expect(overview(page)).toContainText('Frontend Developer')
  await page.getByRole('button',{name:'Retry selection'}).click()
  await expect(overview(page)).toContainText('Backend Developer')
})

test('empty mock catalogue remains usable after demo login without invented metrics',async({page})=>{
  await page.goto('/login?mockScenario=empty')
  await page.getByRole('button',{name:'Try mock demo account'}).click()
  await page.getByRole('link',{name:'Continue to Dashboard'}).click()
  await expect(page.getByText('No career paths available.',{exact:true})).toBeVisible()
  await expect(overview(page)).toHaveCount(0)
  await expect(page.locator('dl')).toHaveCount(0)
})


test('pending latest selection finishes while visiting another application route',async({page})=>{
  await demo(page,'?mockLatencyMs=180')
  await page.getByRole('button',{name:'Choose Frontend Developer',exact:true}).click()
  await page.getByRole('button',{name:'Choose Backend Developer',exact:true}).click()
  await page.getByRole('button',{name:'Choose Data Analyst',exact:true}).click()
  await navigate(page,'Learning')
  await expect(page.getByRole('heading',{name:'Learning',exact:true})).toBeVisible()
  await navigate(page,'Dashboard')
  await expect(page.getByRole('status')).toContainText('Career selection saved')
  await expect(overview(page)).toContainText('Data Analyst')
})

test('pending selection reconciles after browser Back through the signed-in login page',async({page})=>{
  await demo(page)
  await page.evaluate(async()=>{
    const modulePath='/src/services/index.ts'
    const {service}=await import(modulePath)
    const original=service.setSelectedCareers.bind(service)
    const gate = new Promise<void>((resolve)=>{
      Object.assign(window,{releaseCareerWrite:resolve})
    })
    service.setSelectedCareers=async(ids:string[])=>{
      await gate
      return original(ids)
    }
  })
  await page.getByRole('button',{name:'Choose Backend Developer',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Saving your career selection')
  await page.goBack()
  await expect(page).toHaveURL('/login')
  // Account forms stay outside the keyed workspace, retaining their success UI.
  await expect(page.getByRole('status')).toContainText('Signed in as Demo Student.')
  await page.getByRole('link',{name:'Continue to Dashboard'}).click()
  await expect(overview(page)).toContainText('Frontend Developer')
  await page.evaluate(()=>{
    (window as Window & {releaseCareerWrite:()=>void}).releaseCareerWrite()
  })
  await expect(page.getByRole('status')).toContainText('Career selection saved')
  await expect(overview(page)).toContainText('Backend Developer')
  await expect(overview(page)).toContainText('0 of 4 unique skills completed')
  await page.getByRole('button',{name:'Choose Data Analyst',exact:true}).click()
  await expect(overview(page)).toContainText('Data Analyst')
})
